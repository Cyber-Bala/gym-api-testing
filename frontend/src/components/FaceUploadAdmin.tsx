import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanFace, Upload, Images, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, Badge, Alert, PageHeader, Tabs, ProgressBar } from '../ui/primitives';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { SyncStatusBanner } from './SyncStatusBanner';

/* ─────────── Types ─────────── */

type FaceStatus =
  | 'REGISTERED'
  | 'NOT_FOUND'
  | 'DETAILS_MISMATCH'
  | 'ALREADY_REGISTERED'
  | 'PHOTO_REJECTED'
  | 'SERVICE_ERROR';

interface FaceResult {
  rollNumber: string;
  status: FaceStatus;
  message: string;
  name?: string;
  gateStatus?: 'enrolled' | 'pending';
}

interface BulkRow {
  id: string;
  file: File;
  rollNumber: string;
  name: string; // from CSV, may be empty
  state: 'ready' | 'sending' | 'done';
  result?: FaceResult;
}

const STATUS_LABEL: Record<FaceStatus, string> = {
  REGISTERED: 'ID photo saved',
  NOT_FOUND: 'Not in records',
  DETAILS_MISMATCH: 'Details differ',
  ALREADY_REGISTERED: 'Already registered',
  PHOTO_REJECTED: 'Photo rejected',
  SERVICE_ERROR: 'Service error',
};

/* ─────────── Helpers ─────────── */

/** Downscale to <=1280px JPEG so phone photos stay under the API body limit. Returns raw base64. */
async function fileToBase64(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.92);
  return url.slice(url.indexOf(',') + 1);
}

/** "2024CS001.jpg" -> "2024CS001" */
const rollFromFileName = (name: string): string => name.replace(/\.[^.]+$/, '').trim();

/** CSV with a roll column and a name column (header optional). */
function parseCsv(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return out;
  const cells = (l: string) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const head = cells(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = head.some((h) => /roll|reg|id/.test(h)) && head.some((h) => /name/.test(h));
  let ri = 0;
  let ni = 1;
  if (hasHeader) {
    ri = head.findIndex((h) => /roll|reg|id/.test(h));
    ni = head.findIndex((h) => /name/.test(h));
  }
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const c = cells(line);
    if (c[ri]) out.set(c[ri].toLowerCase(), c[ni] ?? '');
  }
  return out;
}

const tone = (s: FaceStatus): 'success' | 'warning' | 'danger' =>
  s === 'REGISTERED' ? 'success' : s === 'PHOTO_REJECTED' || s === 'SERVICE_ERROR' ? 'danger' : 'warning';

const ResultBadge: React.FC<{ r: FaceResult }> = ({ r }) => (
  <Badge tone={tone(r.status)}>
    {r.status === 'REGISTERED' ? <CheckCircle2 className="h-3 w-3" /> : r.status === 'PHOTO_REJECTED' || r.status === 'SERVICE_ERROR' ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
    {STATUS_LABEL[r.status]}
  </Badge>
);

async function send(rollNumber: string, name: string, file: File): Promise<FaceResult> {
  try {
    return await api.post<FaceResult>('/api/v1/face-ml/register', {
      rollNumber,
      name: name || undefined,
      imageBase64: await fileToBase64(file),
    });
  } catch (err) {
    return {
      rollNumber,
      status: 'SERVICE_ERROR',
      message: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

/* ─────────── Component ─────────── */

export const FaceUploadAdmin: React.FC = () => {
  const toast = useToast();
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [service, setService] = useState<{ online: boolean; registered?: number } | null>(null);

  const checkService = useCallback(async () => {
    try {
      setService(await api.get('/api/v1/face-ml/health'));
    } catch {
      setService({ online: false });
    }
  }, []);

  useEffect(() => {
    void checkService();
  }, [checkService]);

  /* ----- single ----- */
  const [roll, setRoll] = useState('');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const submitSingle = async () => {
    if (!roll.trim() || !name.trim() || !photo) {
      toast.error('Roll number, name and photo are required.', 'Missing details');
      return;
    }
    setBusy(true);
    setResult(null);
    const r = await send(roll.trim(), name.trim(), photo);
    setResult(r);
    setBusy(false);
    if (r.status === 'REGISTERED') {
      toast.success(r.message, 'ID photo saved');
      setRoll('');
      setName('');
      setPhoto(null);
      void checkService();
    }
  };

  /* ----- bulk ----- */
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [csv, setCsv] = useState<Map<string, string>>(new Map());
  const [csvName, setCsvName] = useState('');
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    const next: BulkRow[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file, i) => ({
        id: `${file.name}-${file.size}-${i}`,
        file,
        rollNumber: rollFromFileName(file.name),
        name: '',
        state: 'ready',
      }));
    setRows(next);
  };

  const onCsv = async (file: File | undefined) => {
    if (!file) return;
    setCsv(parseCsv(await file.text()));
    setCsvName(file.name);
  };

  const view = useMemo(
    () => rows.map((r) => ({ ...r, name: csv.get(r.rollNumber.toLowerCase()) ?? '' })),
    [rows, csv]
  );

  const runBulk = async () => {
    setRunning(true);
    stopRef.current = false;
    for (const row of view) {
      if (stopRef.current) break;
      if (row.state === 'done' && row.result?.status === 'REGISTERED') continue;
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, state: 'sending' } : x)));
      const r = await send(row.rollNumber, row.name, row.file);
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, state: 'done', result: r } : x)));
      if (r.status === 'SERVICE_ERROR' && r.message.startsWith('Face service is not reachable')) break;
    }
    setRunning(false);
    void checkService();
  };

  const done = view.filter((r) => r.state === 'done').length;
  const okCount = view.filter((r) => r.result?.status === 'REGISTERED').length;
  const problems = view.filter((r) => r.result && r.result.status !== 'REGISTERED');

  /* ─────────── Render ─────────── */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Face Upload"
        description="Upload ID photos, one or many. The student must already be in the records. The photo is the reference: students then register their own face from the student portal, or a teacher does it with the camera."
        badge={
          service && (
            <Badge tone={service.online ? 'success' : 'danger'}>
              {service.online ? `Face service online · ${service.registered ?? 0} registered` : 'Face service offline'}
            </Badge>
          )
        }
      />

      <SyncStatusBanner />

      {service && !service.online && (
        <Alert tone="danger">
          Face service is not reachable. Start <b>face_ML/start_service.bat</b>, then reload this page.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'single', label: 'Single student', icon: <Upload className="h-4 w-4" /> },
          { id: 'bulk', label: 'Bulk upload', icon: <Images className="h-4 w-4" /> },
        ]}
      />

      {tab === 'single' && (
        <Card className="space-y-4 max-w-xl">
          <Input label="Roll number" value={roll} onChange={(e) => setRoll(e.target.value)} required />
          <Input
            label="Student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Checked against the student record."
            required
          />
          <Input
            label="ID photo"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            required
          />
          {preview && <img src={preview} alt="Selected" className="max-h-60 rounded-lg object-contain" />}
          <Button onClick={submitSingle} loading={busy} disabled={busy || service?.online === false}>
            <ScanFace className="h-4 w-4" /> Save ID photo
          </Button>
          {result && (
            <Alert tone={result.status === 'REGISTERED' ? 'success' : result.status === 'PHOTO_REJECTED' || result.status === 'SERVICE_ERROR' ? 'danger' : 'warning'}>
              <div className="flex items-center gap-2 font-medium">
                <ResultBadge r={result} />
              </div>
              <p className="mt-1">{result.message}</p>
            </Alert>
          )}
        </Card>
      )}

      {tab === 'bulk' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Name each photo with the student&apos;s roll number, for example <b>2024CS001.jpg</b>. Optionally add a CSV
              (<b>rollNumber,name</b>) so the names are checked against the records too.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Photos" type="file" accept="image/*" multiple onChange={(e) => onPhotos(e.target.files)} />
              <Input
                label="Details CSV (optional)"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onCsv(e.target.files?.[0])}
                hint={csvName ? `${csvName}: ${csv.size} rows` : undefined}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runBulk} disabled={!rows.length || running || service?.online === false} loading={running}>
                <Upload className="h-4 w-4" /> Save {rows.length ? `${rows.length - okCount} ID photos` : 'ID photos'}
              </Button>
              {running && (
                <Button variant="outline" onClick={() => (stopRef.current = true)}>
                  Stop
                </Button>
              )}
              {rows.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {done}/{rows.length} processed · {okCount} registered
                </span>
              )}
            </div>
            {rows.length > 0 && <ProgressBar value={(done / rows.length) * 100} tone="success" />}
          </Card>

          {problems.length > 0 && (
            <Alert tone="warning">
              {problems.length} photo(s) were not registered. Please go to the admin and check these students once.
            </Alert>
          )}

          {view.length > 0 && (
            <Card padded={false} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3">Photo</th>
                    <th className="px-4 py-3">Roll number</th>
                    <th className="px-4 py-3">Name (CSV)</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((r) => (
                    <tr key={r.id} className="border-t border-border/40 align-top">
                      <td className="px-4 py-3 max-w-[10rem] truncate">{r.file.name}</td>
                      <td className="px-4 py-3 font-mono">{r.rollNumber}</td>
                      <td className="px-4 py-3">{r.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">
                        {r.state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                        {r.state === 'ready' && <span className="text-muted-foreground">Waiting</span>}
                        {r.result && (
                          <div className="space-y-1">
                            <ResultBadge r={r.result} />
                            <p className="text-xs text-muted-foreground">{r.result.message}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
