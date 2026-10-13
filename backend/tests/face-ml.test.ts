import { describe, it, expect, vi, beforeEach } from 'vitest';

const rows: { value: unknown[] } = { value: [] };

vi.mock('../src/shared/database/index.js', () => {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => rows.value,
  };
  return { db: chain, pool: {} };
});

const sync = { onGate: false, message: 'ok' };
vi.mock('../src/modules/device-sync/zkbio-provision.service.js', () => ({
  saveFacePhoto: vi.fn(async () => undefined),
  reconcileStudent: vi.fn(async () => ({ action: 'kept_local', ...sync })),
}));

import { faceMlService, namesMatch } from '../src/modules/face-ml/face-ml.service.js';
import { saveFacePhoto, reconcileStudent } from '../src/modules/device-sync/zkbio-provision.service.js';

const photo = 'A'.repeat(2000);
const student = { studentId: 's1', personId: 'p1', rollNumber: '2024CS001', name: 'Bharatth Sankar' };

const mlReply = (status: number, body: unknown = {}) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('namesMatch', () => {
  it('matches same words in any order, case and punctuation insensitive', () => {
    expect(namesMatch('bharatth sankar', 'Bharatth Sankar')).toBe(true);
    expect(namesMatch('Sankar, Bharatth', 'Bharatth Sankar')).toBe(true);
  });
  it('matches a shorter form of the name', () => {
    expect(namesMatch('Bharatth', 'Bharatth Sankar')).toBe(true);
  });
  it('rejects a different person', () => {
    expect(namesMatch('Balamurugan', 'Bharatth Sankar')).toBe(false);
    expect(namesMatch('', 'Bharatth Sankar')).toBe(false);
  });
});

describe('FaceMlService.register', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    rows.value = [student];
  });

  it('NOT_FOUND when student is not in the records, and never calls the face service', async () => {
    rows.value = [];
    const f = mlReply(200);
    const r = await faceMlService.register({ rollNumber: 'X1', imageBase64: photo });
    expect(r.status).toBe('NOT_FOUND');
    expect(r.message).toContain('go to the admin');
    expect(f).not.toHaveBeenCalled();
  });

  it('DETAILS_MISMATCH when typed name differs from the record', async () => {
    const f = mlReply(200);
    const r = await faceMlService.register({ rollNumber: '2024CS001', name: 'Someone Else', imageBase64: photo });
    expect(r.status).toBe('DETAILS_MISMATCH');
    expect(f).not.toHaveBeenCalled();
  });

  it('PHOTO_REJECTED passes the face service reason through', async () => {
    mlReply(422, { detail: 'No face found in the photo.' });
    const r = await faceMlService.register({ rollNumber: '2024CS001', imageBase64: photo });
    expect(r.status).toBe('PHOTO_REJECTED');
    expect(r.message).toContain('No face found');
  });

  it('ALREADY_REGISTERED on 409', async () => {
    mlReply(409, { detail: 'Student ID already registered.' });
    const r = await faceMlService.register({ rollNumber: '2024CS001', imageBase64: photo });
    expect(r.status).toBe('ALREADY_REGISTERED');
    expect(r.message).toContain('go to the admin');
  });

  it('SERVICE_ERROR when the face service is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await faceMlService.register({ rollNumber: '2024CS001', imageBase64: photo });
    expect(r.status).toBe('SERVICE_ERROR');
  });

  it('REGISTERED stores the face in the gym app, then lets the rules decide about ZKBio', async () => {
    mlReply(200, { student_id: '2024CS001' });
    sync.onGate = true;
    sync.message = 'Added to ZKBio.';
    const r = await faceMlService.register({ rollNumber: '2024cs001', name: 'bharatth', imageBase64: photo });
    expect(r.status).toBe('REGISTERED');
    expect(r.gateStatus).toBe('enrolled');
    expect(saveFacePhoto).toHaveBeenCalledWith('s1', photo, 'upload');
    expect(reconcileStudent).toHaveBeenCalledWith('s1');
  });

  it('REGISTERED but gateStatus pending when ZKBio must wait (e.g. day scholar not paid)', async () => {
    mlReply(200);
    sync.onGate = false;
    sync.message = 'Kept in the gym app only; it goes to ZKBio after the pass is paid.';
    const r = await faceMlService.register({ rollNumber: '2024CS001', imageBase64: photo });
    expect(r.status).toBe('REGISTERED');
    expect(r.gateStatus).toBe('pending');
    expect(r.message).toContain('after the pass is paid');
  });
});

describe('FaceMlService.captureEnroll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    rows.value = [student];
  });

  it('NO_PHOTO when no photo was uploaded for the student', async () => {
    mlReply(404, { detail: 'No photo registered for this student.' });
    const r = await faceMlService.captureEnroll({ studentId: 's1', imageBase64: photo });
    expect(r.status).toBe('NO_PHOTO');
    expect(r.message).toContain('Upload');
    expect(reconcileStudent).not.toHaveBeenCalled();
  });

  it('NO_MATCH when the capture is a different face, and never pushes to the gate', async () => {
    mlReply(200, { match: false, score: 0.05, threshold: 0.25 });
    const r = await faceMlService.captureEnroll({ studentId: 's1', imageBase64: photo });
    expect(r.status).toBe('NO_MATCH');
    expect(r.message).toContain('go to the admin');
    expect(saveFacePhoto).not.toHaveBeenCalled();
    expect(reconcileStudent).not.toHaveBeenCalled();
  });

  it('REGISTERED after a match, stored, and synced to ZKBio when eligible', async () => {
    mlReply(200, { match: true, score: 0.7, threshold: 0.25 });
    sync.onGate = true;
    sync.message = 'Added to ZKBio.';
    const r = await faceMlService.captureEnroll({ studentId: 's1', imageBase64: photo });
    expect(r.status).toBe('REGISTERED');
    expect(r.gateStatus).toBe('enrolled');
    expect(saveFacePhoto).toHaveBeenCalledWith('s1', photo, 'capture');
  });

  it('PHOTO_REJECTED when the capture has no usable face', async () => {
    mlReply(422, { detail: 'No face found in the photo.' });
    const r = await faceMlService.captureEnroll({ studentId: 's1', imageBase64: photo });
    expect(r.status).toBe('PHOTO_REJECTED');
  });
});
