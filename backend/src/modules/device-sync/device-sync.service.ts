import { eq } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { config } from '../../config/index.js';
import { students } from '../../db/schema/index.js';
import { ServiceUnavailableError } from '../../shared/errors/index.js';
import { faceMlService } from '../face-ml/face-ml.service.js';

/**
 * Bridge helper: gym-app (Postgres, app truth for payment) → api_app
 * (SQLite, gate cache) → ZKBio portal (hardware truth).
 *
 * Every payment/activation/expiry MUST call syncPaymentToApiApp so the
 * turnstile gate (which reads api_app access_enabled) matches what the
 * student paid for. All calls are best-effort: Postgres is updated first,
 * device sync failures only warn so checkout never breaks when the
 * gate network is down.
 */

const headers = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

function baseUrl(): string {
  return config.API_APP_URL.replace(/\/+$/, '');
}

export interface ApiAppPaymentPayload {
  payment_status: 'paid' | 'unpaid' | 'expired';
  payment_valid_from?: string | null;
  payment_valid_until?: string | null;
}

/**
 * Push a student's payment/access state to api_app (which forwards the
 * access-level grant/revoke to the ZKBio device).
 */
export async function syncPaymentToApiApp(
  rollNumber: string,
  payload: ApiAppPaymentPayload,
): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(`${baseUrl()}/api/students/${encodeURIComponent(rollNumber)}/payment`, {
        method: 'PATCH',
        headers,
        signal: ctrl.signal,
        body: JSON.stringify(payload),
      });
      if (res.status === 404) {
        // api_app has no row (e.g. portal-only person) — not fatal.
        logger.warn({ rollNumber }, 'api_app has no student row for payment sync');
        return false;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.warn({ rollNumber, status: res.status, body }, 'api_app payment sync rejected');
        return false;
      }
      logger.info({ rollNumber, ...payload }, 'Payment state synced to api_app/device');
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn({ err, rollNumber }, 'api_app payment sync failed (device may be offline)');
    return false;
  }
}

/**
 * Ask api_app for its authoritative gate decision (includes the
 * "you should pay" pay-wall message when expired/unpaid).
 */
export async function checkGateAccess(rollNumber: string): Promise<{
  allowed: boolean;
  message: string;
  payment_status?: string;
} | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(`${baseUrl()}/api/access/check/${encodeURIComponent(rollNumber)}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as { allowed: boolean; message: string; payment_status?: string };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export interface ReconcileResult {
  apiReachable: boolean;
  apiStudents: number;
  missingInApi: string[];
  missingLocally: string[];
  deletedLocally: string[];
  dryRun: boolean;
}

/**
 * Reconcile gym-app Postgres against api_app SQLite.
 *
 * - missingInApi: rolls in Postgres but not in api_app (push needed).
 * - missingLocally: rolls in api_app but not in Postgres. These are
 *   portal-side creates (admin panel → api_app pull) that never had a
 *   gym-app profile — reported, never auto-created (no email/dept).
 * - When deleteMissingLocally=true, local students whose roll is absent
 *   from api_app AND whose last portal pull succeeded are deleted via
 *   peopleService (portal delete → api_app pull → gym-app propagation).
 *   Guarded: refuses to delete when api_app is unreachable or its last
 *   portal pull failed, so a network outage can never wipe the directory.
 */
export async function reconcileFromApiApp(deleteMissingLocally = false): Promise<ReconcileResult> {
  const { peopleService } = await import('../people/people.service.js');

  let apiRows: Array<{ roll_no: string }> = [];
  let lastPullOk: boolean | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const [studentsRes, statusRes] = await Promise.all([
        fetch(`${baseUrl()}/api/students?limit=500`, { headers }).catch(() =>
          fetch(`${baseUrl()}/api/students`, { headers }),
        ),
        fetch(`${baseUrl()}/api/sync/status`, { headers }),
      ]);
      if (!studentsRes.ok) {
        return {
          apiReachable: false, apiStudents: 0, missingInApi: [],
          missingLocally: [], deletedLocally: [], dryRun: true,
        };
      }
      apiRows = (await studentsRes.json()) as Array<{ roll_no: string }>;
      if (statusRes.ok) {
        const status = (await statusRes.json()) as { last_pull_ok?: boolean | null };
        lastPullOk = status.last_pull_ok ?? null;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn({ err }, 'Device reconcile: api_app unreachable');
    return {
      apiReachable: false, apiStudents: 0, missingInApi: [],
      missingLocally: [], deletedLocally: [], dryRun: true,
    };
  }

  const apiRolls = new Set(apiRows.map((r) => r.roll_no));
  const localRows = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      source: students.source,
      zkbioSynced: students.zkbioSynced,
    })
    .from(students);
  const localRolls = new Set(localRows.map((r) => r.rollNumber));
  // Students that were never sent to ZKBio (waiting for a face / payment) are not "missing": they
  // simply are not there yet. Only people that came from ZKBio, or that we added, can go missing.
  const trackedRolls = new Set(
    localRows.filter((r) => r.source === 'zkbio' || r.zkbioSynced).map((r) => r.rollNumber)
  );

  const missingInApi = [...trackedRolls].filter((r) => !apiRolls.has(r));
  const missingLocally = [...apiRolls].filter((r) => !localRolls.has(r));
  const deletedLocally: string[] = [];

  if (deleteMissingLocally) {
    if (lastPullOk !== true) {
      logger.warn(
        { lastPullOk },
        'Device reconcile: refusing deletes — api_app portal pull not confirmed fresh',
      );
      return { apiReachable: true, apiStudents: apiRows.length, missingInApi, missingLocally, deletedLocally, dryRun: true };
    }
    const byRoll = new Map(localRows.map((r) => [r.rollNumber, r.id]));
    // Only delete rolls absent from api_app (portal deleted them).
    for (const roll of missingInApi) {
      const id = byRoll.get(roll);
      if (!id) continue;
      try {
        await peopleService.deleteStudent(id, 'system:device-reconcile');
        deletedLocally.push(roll);
      } catch (err) {
        logger.warn({ err, roll }, 'Device reconcile: local delete failed');
      }
    }
  }

  return {
    apiReachable: true,
    apiStudents: apiRows.length,
    missingInApi,
    missingLocally,
    deletedLocally,
    dryRun: !deleteMissingLocally,
  };
}


/* ───────────── Health: is every connected app turned on? ───────────── */

export const GYM_API_OFFLINE_MSG =
  'The Gym API is not running. Turn on the Gym API app (and its ngrok tunnel), then try again.';
export const FACE_SERVICE_OFFLINE_MSG =
  'The face service is not running. Turn on face_ML (start.bat), then try again.';
export const ZKBIO_OFFLINE_MSG =
  'The Gym API cannot reach the ZKBio portal. Turn on the ZKBio server and check its IP address and token.';

export interface BridgeHealth {
  ok: boolean;
  gymApi: { up: boolean; message: string };
  zkbio: { up: boolean | null; message: string; lastPullAt: string | null };
  faceService: { up: boolean; message: string; registered?: number };
  issues: string[];
}

async function probeGymApi(): Promise<{
  up: boolean;
  status?: { zkbio_enabled?: boolean; last_pull_ok?: boolean | null; last_pull_at?: string | null };
}> {
  try {
    const res = await fetch(`${baseUrl()}/api/sync/status`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return { up: true, status: (await res.json()) as any };
    // Older api_app without /api/sync/status: fall back to a plain reachability check.
    const alt = await fetch(`${baseUrl()}/api/stats`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(6000),
    });
    return { up: alt.ok };
  } catch {
    return { up: false };
  }
}

export async function getBridgeHealth(): Promise<BridgeHealth> {
  const [api, face] = await Promise.all([probeGymApi(), faceMlService.health()]);
  const issues: string[] = [];

  const gymApi = api.up
    ? { up: true, message: 'Gym API is running.' }
    : { up: false, message: GYM_API_OFFLINE_MSG };
  if (!gymApi.up) issues.push(GYM_API_OFFLINE_MSG);

  let zkbio: BridgeHealth['zkbio'] = { up: null, message: 'Unknown until the Gym API is running.', lastPullAt: null };
  if (api.up) {
    const st = api.status;
    if (st?.zkbio_enabled === false) {
      zkbio = { up: null, message: 'ZKBio sync is switched off in the Gym API (manual mode).', lastPullAt: null };
    } else if (st?.last_pull_ok === false) {
      zkbio = { up: false, message: ZKBIO_OFFLINE_MSG, lastPullAt: st.last_pull_at ?? null };
      issues.push(ZKBIO_OFFLINE_MSG);
    } else if (st?.last_pull_ok === true) {
      zkbio = { up: true, message: 'ZKBio portal is reachable.', lastPullAt: st.last_pull_at ?? null };
    }
  }

  const faceService = face.online
    ? { up: true, message: 'Face service is running.', registered: face.registered }
    : { up: false, message: FACE_SERVICE_OFFLINE_MSG };
  if (!faceService.up) issues.push(FACE_SERVICE_OFFLINE_MSG);

  return { ok: issues.length === 0, gymApi, zkbio, faceService, issues };
}

/**
 * Block an admin write (create / import / delete) while a connected app is off,
 * so the apps never drift apart. Tells the admin exactly what to turn on.
 */
export async function assertSyncReady(opts: { needFaceService?: boolean; skipGymApi?: boolean } = {}): Promise<void> {
  if (config.NODE_ENV === 'test' && !process.env.FORCE_SYNC_CHECK) return; // unit tests run without the connected apps
  const [api, face] = await Promise.all([
    opts.skipGymApi ? Promise.resolve({ up: true }) : probeGymApi(),
    opts.needFaceService ? faceMlService.health() : Promise.resolve({ online: true }),
  ]);
  if (!api.up) throw new ServiceUnavailableError(GYM_API_OFFLINE_MSG, { service: 'gym_api' });
  if (!face.online) throw new ServiceUnavailableError(FACE_SERVICE_OFFLINE_MSG, { service: 'face_service' });
}
