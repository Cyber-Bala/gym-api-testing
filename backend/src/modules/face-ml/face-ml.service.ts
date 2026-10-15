import { sql, eq } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { students, people } from '../../db/schema/index.js';
import { config } from '../../config/index.js';
import { saveFacePhoto, reconcileStudent, hasFacePhoto } from '../device-sync/zkbio-provision.service.js';
import type {
  FaceMlCaptureDto,
  FaceMlRegisterDto,
  FaceMlResult,
  FaceMlSelfStatus,
} from './face-ml.types.js';

const GO_TO_ADMIN = 'Please go to the admin and check the student details once.';

const normalizeName = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * True when the typed name and the record name describe the same person:
 * same words in any order, or every word of the shorter name appears in the longer
 * (covers "Bharatth S" vs "Bharatth Sankar").
 */
export function namesMatch(typed: string, record: string): boolean {
  const a = normalizeName(typed);
  const b = normalizeName(record);
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((w) => long.includes(w));
}

export class FaceMlService {
  public async health(): Promise<{ online: boolean; registered?: number }> {
    try {
      const res = await fetch(`${config.FACE_ML_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return { online: false };
      const data = (await res.json()) as { students?: number };
      return { online: true, registered: data.students };
    } catch {
      return { online: false };
    }
  }

  /**
   * Remove a student's face data from face_ML (uploaded photo and face vector).
   * 'missing' = nothing was registered there, which is fine.
   */
  public async remove(rollNumber: string): Promise<'removed' | 'missing' | 'failed'> {
    try {
      const res = await fetch(`${config.FACE_ML_URL}/api/admin/students/${encodeURIComponent(rollNumber)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': config.FACE_ML_TOKEN },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return 'removed';
      if (res.status === 404) return 'missing';
      logger.warn({ rollNumber, status: res.status }, 'face_ML delete rejected');
      return 'failed';
    } catch (err) {
      logger.warn({ err, rollNumber }, 'face_ML delete failed (service offline?)');
      return 'failed';
    }
  }

  /**
   * Student portal: can this signed-in student register their own face right now?
   * They can when an ID photo is on file (uploaded by an admin) and no face is saved yet.
   */
  public async selfStatus(personId: string): Promise<FaceMlSelfStatus> {
    const [row] = await db
      .select({ studentId: students.id, rollNumber: students.rollNumber, source: students.source })
      .from(students)
      .where(eq(students.personId, personId))
      .limit(1);

    if (!row) {
      return { state: 'not_student', canRegister: false, message: 'Face registration from the portal is for students.' };
    }
    const base = { rollNumber: row.rollNumber };
    if (row.source === 'zkbio') {
      return {
        ...base,
        state: 'managed',
        canRegister: false,
        message: 'Your face is managed in ZKBio. Please meet the admin for any change.',
      };
    }
    if (await hasFacePhoto(row.studentId)) {
      return {
        ...base,
        state: 'already',
        canRegister: false,
        message: 'Your face is already registered. To change it, please meet the admin.',
      };
    }
    const photo = await this.hasPhoto(row.rollNumber);
    if (!photo.online) {
      return {
        ...base,
        state: 'service_offline',
        canRegister: false,
        message: 'Face registration is not available right now. Please try again later or meet the admin.',
      };
    }
    if (!photo.registered) {
      return {
        ...base,
        state: 'no_id_photo',
        canRegister: false,
        message: 'Your details are not in the admin portal yet. Please meet the admin to get them added.',
      };
    }
    return { ...base, state: 'ready', canRegister: true, message: 'Take a live photo. It is checked against your ID photo.' };
  }

  /**
   * Student portal registration: the live capture must match the ID photo on file,
   * then it is saved (and goes to ZKBio when the rules allow it).
   */
  public async selfRegister(personId: string, imageBase64: string): Promise<FaceMlResult> {
    const status = await this.selfStatus(personId);
    const [row] = await db
      .select({ studentId: students.id })
      .from(students)
      .where(eq(students.personId, personId))
      .limit(1);
    if (!status.canRegister || !row) {
      return {
        rollNumber: status.rollNumber ?? '',
        status: status.state === 'no_id_photo' ? 'NO_PHOTO' : 'NOT_FOUND',
        message: status.message,
      };
    }
    return this.captureEnroll({ studentId: row.studentId, imageBase64 });
  }

  /** Has a photo been uploaded (Face Upload) for this roll number? */
  public async hasPhoto(rollNumber: string): Promise<{ registered: boolean; online: boolean }> {
    try {
      const res = await fetch(`${config.FACE_ML_URL}/api/admin/exists/${encodeURIComponent(rollNumber)}`, {
        headers: { 'X-Admin-Token': config.FACE_ML_TOKEN },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { registered: false, online: false };
      return { registered: ((await res.json()) as { registered: boolean }).registered, online: true };
    } catch {
      return { registered: false, online: false };
    }
  }

  /**
   * Webcam capture on the Face Registration page:
   *  1. an uploaded photo must exist for the student, else tell the admin to upload it
   *  2. the live capture must match that photo
   *  3. then push the capture to the gate (existing ZKBio sync)
   */
  public async captureEnroll(dto: FaceMlCaptureDto): Promise<FaceMlResult> {
    const [row] = await db
      .select({
        studentId: students.id,
        personId: people.id,
        rollNumber: students.rollNumber,
        name: people.name,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(eq(students.id, dto.studentId))
      .limit(1);

    if (!row) {
      return {
        rollNumber: dto.studentId,
        status: 'NOT_FOUND',
        message: `Student not found in the records. ${GO_TO_ADMIN}`,
      };
    }

    const base = { rollNumber: row.rollNumber, name: row.name };
    let b64 = dto.imageBase64.trim();
    if (b64.startsWith('data:')) b64 = b64.slice(b64.indexOf(',') + 1);
    b64 = b64.replace(/\s+/g, '');

    const form = new FormData();
    form.append('student_id', row.rollNumber);
    form.append('photos', new Blob([Buffer.from(b64, 'base64')], { type: 'image/jpeg' }), 'capture.jpg');

    let res: Response;
    try {
      res = await fetch(`${config.FACE_ML_URL}/api/admin/match`, {
        method: 'POST',
        headers: { 'X-Admin-Token': config.FACE_ML_TOKEN },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      logger.warn({ err, rollNumber: row.rollNumber }, 'face_ML service unreachable');
      return {
        ...base,
        status: 'SERVICE_ERROR',
        message: 'Face service is not reachable. Start face_ML/start.bat and try again.',
      };
    }

    if (res.status === 404) {
      return {
        ...base,
        status: 'NO_PHOTO',
        message: `No ID photo is on file for ${row.name} (${row.rollNumber}), so the face cannot be checked. ${GO_TO_ADMIN}`,
      };
    }
    if (!res.ok) {
      const detail = ((await res.json().catch(() => ({}))) as { detail?: string }).detail ?? '';
      if (res.status === 422) return { ...base, status: 'PHOTO_REJECTED', message: detail || 'Capture not usable. Retake.' };
      return { ...base, status: 'SERVICE_ERROR', message: `Face service error (HTTP ${res.status}).` };
    }

    const m = (await res.json()) as { match: boolean; score: number };
    if (!m.match) {
      return {
        ...base,
        status: 'NO_MATCH',
        score: m.score,
        message: `The captured face does not match the uploaded photo for ${row.rollNumber}. ${GO_TO_ADMIN}`,
      };
    }

    // The webcam capture is the better template for the gate: keep it, then let the
    // rules decide whether ZKBio gets it now (hosteller / paid) or later (awaiting payment).
    await saveFacePhoto(row.studentId, b64, 'capture');
    const sync = await reconcileStudent(row.studentId);
    return {
      ...base,
      status: 'REGISTERED',
      score: m.score,
      gateStatus: sync.onGate ? 'enrolled' : 'pending',
      message: `Face matched the uploaded photo. ${sync.message}`,
    };
  }

  /**
   * One photo for one student:
   *  1. student must already exist in the gym database (and typed details must match)
   *  2. face_ML checks the photo (one usable face) and stores the face vector
   *  3. the photo is pushed to the gate, same as the existing Face Registration page
   */
  public async register(dto: FaceMlRegisterDto): Promise<FaceMlResult> {
    const rollNumber = dto.rollNumber;

    const [row] = await db
      .select({
        studentId: students.id,
        personId: people.id,
        rollNumber: students.rollNumber,
        name: people.name,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(sql`lower(${students.rollNumber}) = ${rollNumber.toLowerCase()}`)
      .limit(1);

    if (!row) {
      return {
        rollNumber,
        status: 'NOT_FOUND',
        message: `No student with roll number '${rollNumber}' in the records. ${GO_TO_ADMIN}`,
      };
    }

    if (dto.name && !namesMatch(dto.name, row.name)) {
      return {
        rollNumber: row.rollNumber,
        status: 'DETAILS_MISMATCH',
        name: row.name,
        message: `Name '${dto.name}' does not match the record for ${row.rollNumber}. ${GO_TO_ADMIN}`,
      };
    }

    let b64 = dto.imageBase64.trim();
    if (b64.startsWith('data:')) b64 = b64.slice(b64.indexOf(',') + 1);
    b64 = b64.replace(/\s+/g, '');

    // --- face_ML: quality check + store face vector -------------------------
    const form = new FormData();
    form.append('student_id', row.rollNumber);
    form.append('name', row.name);
    form.append('photo', new Blob([Buffer.from(b64, 'base64')], { type: 'image/jpeg' }), 'photo.jpg');

    let mlRes: Response;
    try {
      mlRes = await fetch(`${config.FACE_ML_URL}/api/admin/register`, {
        method: 'POST',
        headers: { 'X-Admin-Token': config.FACE_ML_TOKEN },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      logger.warn({ err, rollNumber }, 'face_ML service unreachable');
      return {
        rollNumber: row.rollNumber,
        status: 'SERVICE_ERROR',
        name: row.name,
        message: 'Face service is not reachable. Start it (face_ML/start_service.bat) and try again.',
      };
    }

    if (!mlRes.ok) {
      const detail = ((await mlRes.json().catch(() => ({}))) as { detail?: string }).detail ?? '';
      if (mlRes.status === 409) {
        return {
          rollNumber: row.rollNumber,
          status: 'ALREADY_REGISTERED',
          name: row.name,
          message: `A face is already registered for ${row.rollNumber}. ${GO_TO_ADMIN}`,
        };
      }
      if (mlRes.status === 422) {
        return {
          rollNumber: row.rollNumber,
          status: 'PHOTO_REJECTED',
          name: row.name,
          message: detail || 'Photo not usable.',
        };
      }
      logger.warn({ status: mlRes.status, detail, rollNumber }, 'face_ML register failed');
      return {
        rollNumber: row.rollNumber,
        status: 'SERVICE_ERROR',
        name: row.name,
        message:
          mlRes.status === 401
            ? 'Face service rejected the token. Set FACE_ML_TOKEN to the face_ML admin token.'
            : `Face service error (HTTP ${mlRes.status}).`,
      };
    }

    // The uploaded photo is the REFERENCE ("ID photo on file"). The student's own live capture
    // (student portal, or a teacher with the camera) is checked against it, and only that
    // capture is saved and sent on to ZKBio. So nothing is saved or synced here.
    return {
      rollNumber: row.rollNumber,
      status: 'REGISTERED',
      name: row.name,
      message: `ID photo saved for ${row.name}. They can now register their face from the student portal, or a teacher can do it with the camera.`,
    };
  }
}

export const faceMlService = new FaceMlService();
