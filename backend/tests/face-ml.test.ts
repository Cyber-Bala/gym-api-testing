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
  hasFacePhoto: vi.fn(async () => false),
  reconcileStudent: vi.fn(async () => ({ action: 'kept_local', ...sync })),
}));

import { faceMlService, namesMatch } from '../src/modules/face-ml/face-ml.service.js';
import { saveFacePhoto, reconcileStudent, hasFacePhoto } from '../src/modules/device-sync/zkbio-provision.service.js';

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

  it('REGISTERED saves the ID photo as the reference only: nothing stored or sent to ZKBio', async () => {
    mlReply(200, { student_id: '2024CS001' });
    const r = await faceMlService.register({ rollNumber: '2024cs001', name: 'bharatth', imageBase64: photo });
    expect(r.status).toBe('REGISTERED');
    expect(r.message).toContain('student portal');
    expect(saveFacePhoto).not.toHaveBeenCalled();
    expect(reconcileStudent).not.toHaveBeenCalled();
  });
});

describe('FaceMlService.captureEnroll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    rows.value = [student];
  });

  it('NO_PHOTO when no ID photo is on file: nothing is saved', async () => {
    mlReply(404, { detail: 'No photo registered for this student.' });
    const r = await faceMlService.captureEnroll({ studentId: 's1', imageBase64: photo });
    expect(r.status).toBe('NO_PHOTO');
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

describe('student portal self registration', () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  beforeEach(() => {
    vi.restoreAllMocks();
    rows.value = [{ studentId: 's1', rollNumber: '2024CS001', source: 'app' }];
    vi.mocked(hasFacePhoto).mockResolvedValue(false);
  });

  it('not a student: cannot register', async () => {
    rows.value = [];
    const r = await faceMlService.selfStatus('p1');
    expect(r).toMatchObject({ state: 'not_student', canRegister: false });
  });

  it('ZKBio-origin student: managed in ZKBio, cannot self register', async () => {
    rows.value = [{ studentId: 's1', rollNumber: '2024CS001', source: 'zkbio' }];
    expect(await faceMlService.selfStatus('p1')).toMatchObject({ state: 'managed', canRegister: false });
  });

  it('face already saved: cannot register again, told to meet the admin', async () => {
    vi.mocked(hasFacePhoto).mockResolvedValue(true);
    const r = await faceMlService.selfStatus('p1');
    expect(r).toMatchObject({ state: 'already', canRegister: false });
    expect(r.message).toContain('admin');
  });

  it('no ID photo on file: cannot register, told to meet the admin', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply({ registered: false }));
    const r = await faceMlService.selfStatus('p1');
    expect(r).toMatchObject({ state: 'no_id_photo', canRegister: false });
    expect(r.message).toContain('admin');
  });

  it('ID photo on file: ready', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply({ registered: true }));
    expect(await faceMlService.selfStatus('p1')).toMatchObject({ state: 'ready', canRegister: true });
  });

  it('live face does not match the ID photo: nothing saved', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply({ registered: true })) // selfStatus
      .mockResolvedValueOnce(reply({ match: false, score: 0.02, threshold: 0.25 })); // match
    const r = await faceMlService.selfRegister('p1', photo);
    expect(r.status).toBe('NO_MATCH');
    expect(saveFacePhoto).not.toHaveBeenCalled();
  });

  it('live face matches the ID photo: saved, then the ZKBio rules run', async () => {
    sync.onGate = false;
    sync.message = 'Face saved.';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply({ registered: true }))
      .mockResolvedValueOnce(reply({ match: true, score: 0.8, threshold: 0.25 }));
    const r = await faceMlService.selfRegister('p1', photo);
    expect(r.status).toBe('REGISTERED');
    expect(saveFacePhoto).toHaveBeenCalledWith('s1', photo, 'capture');
    expect(reconcileStudent).toHaveBeenCalledWith('s1');
  });

  it('blocked states never reach the face service match', async () => {
    vi.mocked(hasFacePhoto).mockResolvedValue(true);
    const f = vi.spyOn(globalThis, 'fetch');
    const r = await faceMlService.selfRegister('p1', photo);
    expect(r.status).toBe('NOT_FOUND');
    expect(f).not.toHaveBeenCalled();
  });
});
