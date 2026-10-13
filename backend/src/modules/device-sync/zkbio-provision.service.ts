import { eq, and, gt, lte, desc } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { config } from '../../config/index.js';
import { students, people, memberships } from '../../db/schema/index.js';

/**
 * ZKBio provisioning rules (the gym app database is the source of truth):
 *
 *   - Student data lives in the gym app first. Nothing is sent to ZKBio at import.
 *   - A student is on ZKBio only when BOTH are true:
 *       1. a face is registered (photo stored here), and
 *       2. hosteller  -> nothing more is needed
 *          day scholar -> an active paid pass
 *   - When the pass ends the student is removed from ZKBio (face and access) but stays
 *     in the gym app. After renewal the stored face is pushed to ZKBio again.
 *
 * reconcileStudent() is the single entry point: call it after anything that can change
 * eligibility (face saved, payment, expiry, residency change) and it does the right thing.
 */

export type ProvisionAction = 'provisioned' | 'refreshed' | 'deprovisioned' | 'kept_local' | 'failed' | 'not_found';
export type KeepReason = 'no_face' | 'awaiting_payment';

export interface ProvisionResult {
  action: ProvisionAction;
  /** True when the student is on ZKBio after this call. */
  onGate: boolean;
  reason?: KeepReason;
  message: string;
}

const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
const baseUrl = () => config.API_APP_URL.replace(/\/+$/, '');

/** Same 4-way department routing as the Students page. */
function deptCode(residency: string, gender: string): string {
  const female = gender === 'female';
  if (residency === 'hosteller') return female ? config.ZKBIO_DEPT_HOSTELLER_GIRLS : config.ZKBIO_DEPT_HOSTELLER_BOYS;
  return female ? config.ZKBIO_DEPT_DAY_SCHOLAR_GIRLS : config.ZKBIO_DEPT_DAY_SCHOLAR_BOYS;
}

async function bridge(path: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/* ───────────── stored face photo (kept in the gym app database) ───────────── */

export async function saveFacePhoto(studentId: string, base64: string, source: 'upload' | 'capture'): Promise<void> {
  const raw = base64.startsWith('data:') ? base64.slice(base64.indexOf(',') + 1) : base64;
  await pool.query(
    `INSERT INTO people.student_face_photos (student_id, photo, source, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (student_id) DO UPDATE SET photo = EXCLUDED.photo, source = EXCLUDED.source, updated_at = NOW()`,
    [studentId, Buffer.from(raw.replace(/\s+/g, ''), 'base64'), source]
  );
}

async function getFacePhotoB64(studentId: string): Promise<string | null> {
  const r = await pool.query('SELECT photo FROM people.student_face_photos WHERE student_id = $1', [studentId]);
  return r.rows[0]?.photo ? (r.rows[0].photo as Buffer).toString('base64') : null;
}

async function hasFacePhoto(studentId: string): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM people.student_face_photos WHERE student_id = $1', [studentId]);
  return (r.rowCount ?? 0) > 0;
}

/* ───────────── rules ───────────── */

async function loadStudent(studentId: string) {
  const [row] = await db
    .select({
      id: students.id,
      personId: students.personId,
      rollNumber: students.rollNumber,
      residency: students.residency,
      gender: students.gender,
      zkbioSynced: students.zkbioSynced,
      source: students.source,
      name: people.name,
      phone: people.phone,
    })
    .from(students)
    .innerJoin(people, eq(students.personId, people.id))
    .where(eq(students.id, studentId))
    .limit(1);
  return row ?? null;
}

async function activePass(studentId: string) {
  const now = new Date();
  const [m] = await db
    .select({ startDate: memberships.startDate, endDate: memberships.endDate })
    .from(memberships)
    .where(
      and(
        eq(memberships.studentId, studentId),
        eq(memberships.status, 'active'),
        lte(memberships.startDate, now),
        gt(memberships.endDate, now)
      )
    )
    .orderBy(desc(memberships.endDate))
    .limit(1);
  return m ?? null;
}

const day = (d: Date) => new Date(d).toISOString().slice(0, 10);

export async function evaluate(studentId: string) {
  const s = await loadStudent(studentId);
  if (!s) return null;
  const photo = await hasFacePhoto(studentId);
  const pass = s.residency === 'day_scholar' ? await activePass(studentId) : null;
  // Already on the gate counts as having a face (older students have no stored photo).
  const faceOk = photo || s.zkbioSynced;
  const paidOk = s.residency !== 'day_scholar' || Boolean(pass);
  const reason: KeepReason | undefined = !faceOk ? 'no_face' : !paidOk ? 'awaiting_payment' : undefined;
  return { student: s, photo, pass, eligible: faceOk && paidOk, reason };
}

/* ───────────── bridge steps ───────────── */

async function createPerson(s: NonNullable<Awaited<ReturnType<typeof loadStudent>>>): Promise<void> {
  const dept = deptCode(s.residency, s.gender);
  const res = await bridge('/api/students', {
    method: 'POST',
    body: JSON.stringify({
      roll_no: s.rollNumber,
      name: s.name,
      room_no: 'N/A',
      phone: s.phone || '',
      dept_code: dept,
      residency: s.residency,
      gender: s.gender,
    }),
  });
  if (res.status === 400) {
    // Already there: move them to the right department.
    const p = await bridge(`/api/students/${encodeURIComponent(s.rollNumber)}`, {
      method: 'PATCH',
      body: JSON.stringify({ dept_code: dept, residency: s.residency, gender: s.gender }),
    });
    if (!p.ok) throw new Error(`department update HTTP ${p.status}`);
    return;
  }
  if (!res.ok) throw new Error(`create person HTTP ${res.status}`);
}

async function pushPayment(s: NonNullable<Awaited<ReturnType<typeof loadStudent>>>, pass: { startDate: Date; endDate: Date } | null) {
  const res = await bridge(`/api/students/${encodeURIComponent(s.rollNumber)}/payment`, {
    method: 'PATCH',
    body: JSON.stringify({
      payment_status: 'paid',
      payment_valid_from: pass ? day(pass.startDate) : null,
      payment_valid_until: pass ? day(pass.endDate) : null,
    }),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`access update HTTP ${res.status}`);
  return true;
}

async function markSynced(studentId: string, personId: string, synced: boolean, status: string, note: string | null) {
  await db
    .update(students)
    .set({ zkbioSynced: synced, zkbioSyncedAt: new Date(), zkbioSyncNote: note, faceEnrollmentStatus: status, updatedAt: new Date() })
    .where(eq(students.id, studentId));
  await db.update(people).set({ faceEnrollmentStatus: status, updatedAt: new Date() }).where(eq(people.id, personId));
}

async function markFailed(studentId: string, note: string) {
  await db.update(students).set({ zkbioSyncNote: note, updatedAt: new Date() }).where(eq(students.id, studentId));
}

const offline = (err: unknown) =>
  err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || /fetch failed|ECONN/i.test(err.message));

const fail = (err: unknown): string =>
  offline(err)
    ? 'The Gym API is not reachable. Turn on the Gym API app (and its ngrok tunnel).'
    : err instanceof Error
      ? err.message
      : String(err);

/* ───────────── entry point ───────────── */

export async function reconcileStudent(studentId: string): Promise<ProvisionResult> {
  const ev = await evaluate(studentId);
  if (!ev) return { action: 'not_found', onGate: false, message: 'Student not found.' };
  const { student: s, eligible, pass, photo } = ev;

  // People that came from ZKBio are managed in ZKBio. The gym app never changes their ZKBio data.
  if (s.source === 'zkbio') {
    return { action: 'kept_local', onGate: true, message: 'Managed in ZKBio. The gym app does not change it.' };
  }

  /* not eligible */
  if (!eligible) {
    if (!s.zkbioSynced) {
      if (photo) await markSynced(s.id, s.personId, false, 'pending', null);
      return {
        action: 'kept_local',
        onGate: false,
        reason: ev.reason,
        message:
          ev.reason === 'awaiting_payment'
            ? 'Face saved. Kept in the gym app only; it goes to ZKBio after the pass is paid.'
            : 'Kept in the gym app only; it goes to ZKBio once a face is registered.',
      };
    }
    // Was on ZKBio, no longer eligible (pass ended / moved to day scholar): take them off ZKBio.
    try {
      await bridge(`/api/students/${encodeURIComponent(s.rollNumber)}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_status: 'expired', payment_valid_from: null, payment_valid_until: null }),
      });
      const del = await bridge(`/api/students/${encodeURIComponent(s.rollNumber)}`, { method: 'DELETE' });
      if (!del.ok && del.status !== 404) throw new Error(`remove from ZKBio HTTP ${del.status}`);
      await markSynced(s.id, s.personId, false, photo ? 'pending' : 'not_enrolled', null);
      logger.info({ roll: s.rollNumber }, 'Removed from ZKBio (kept in gym app)');
      return {
        action: 'deprovisioned',
        onGate: false,
        reason: 'awaiting_payment',
        message: 'Pass ended: removed from ZKBio. Still in the gym app; renew to add back.',
      };
    } catch (err) {
      const msg = fail(err);
      await markFailed(s.id, msg);
      logger.warn({ err, roll: s.rollNumber }, 'ZKBio removal failed, will retry');
      return { action: 'failed', onGate: true, message: `Could not remove from ZKBio yet: ${msg}` };
    }
  }

  /* eligible and already on ZKBio: refresh department + pass dates */
  if (s.zkbioSynced) {
    try {
      const ok = await pushPayment(s, pass);
      if (ok) {
        await bridge(`/api/students/${encodeURIComponent(s.rollNumber)}`, {
          method: 'PATCH',
          body: JSON.stringify({ dept_code: deptCode(s.residency, s.gender), residency: s.residency, gender: s.gender }),
        }).catch(() => undefined);
        await markSynced(s.id, s.personId, true, 'enrolled', null);
        return { action: 'refreshed', onGate: true, message: 'ZKBio updated.' };
      }
      // Row vanished on the Gym API side: fall through to a full push if we still have the photo.
      if (!photo) {
        await markSynced(s.id, s.personId, false, 'not_enrolled', 'Missing on ZKBio and no stored face. Register the face again.');
        return { action: 'failed', onGate: false, message: 'Not on ZKBio any more. Register the face again.' };
      }
    } catch (err) {
      const msg = fail(err);
      await markFailed(s.id, msg);
      return { action: 'failed', onGate: true, message: `Could not update ZKBio: ${msg}` };
    }
  }

  /* eligible, not on ZKBio yet: full push */
  try {
    const b64 = await getFacePhotoB64(s.id);
    if (!b64) throw new Error('No stored face photo');
    await createPerson(s);
    const face = await bridge(`/api/students/${encodeURIComponent(s.rollNumber)}/register-face`, {
      method: 'POST',
      body: JSON.stringify({ photo_base64: b64, name: s.name }),
      }, 60_000);
    if (!face.ok) {
      const detail = ((await face.json().catch(() => ({}))) as { detail?: string }).detail;
      throw new Error(detail || `register face HTTP ${face.status}`);
    }
    await pushPayment(s, pass);
    await markSynced(s.id, s.personId, true, 'enrolled', null);
    logger.info({ roll: s.rollNumber }, 'Added to ZKBio');
    return { action: 'provisioned', onGate: true, message: 'Added to ZKBio.' };
  } catch (err) {
    const msg = fail(err);
    await markFailed(s.id, msg);
    logger.warn({ err, roll: s.rollNumber }, 'ZKBio add failed, will retry');
    return {
      action: 'failed',
      onGate: false,
      message: `Face saved, but adding to ZKBio failed: ${msg} It will retry on the next sync.`,
    };
  }
}

/** Fix drift for everyone who has a stored face or is on ZKBio (daily job and the Sync button). */
export async function reconcileAll(): Promise<{ checked: number; provisioned: number; deprovisioned: number; failed: number }> {
  const r = await pool.query(
    `SELECT s.id FROM people.students s
     WHERE s.source = 'app' AND (s.zkbio_synced = true OR EXISTS (SELECT 1 FROM people.student_face_photos f WHERE f.student_id = s.id))`
  );
  const out = { checked: 0, provisioned: 0, deprovisioned: 0, failed: 0 };
  for (const row of r.rows as Array<{ id: string }>) {
    const res = await reconcileStudent(row.id);
    out.checked++;
    if (res.action === 'provisioned') out.provisioned++;
    else if (res.action === 'deprovisioned') out.deprovisioned++;
    else if (res.action === 'failed') out.failed++;
  }
  return out;
}
