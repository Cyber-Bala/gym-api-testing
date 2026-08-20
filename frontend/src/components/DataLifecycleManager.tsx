import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Archive,
  Database,
  GraduationCap,
  RefreshCw,
  Plus,
  CheckCircle2,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  X,
  Users,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, Stat, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface ArchiveJob {
  id: string;
  entityType: string;
  cutoffDate: string;
  recordCount: number;
  status: 'completed' | 'running' | 'failed';
  storagePath: string;
  createdAt: string;
}

interface LifecycleSummary {
  totalArchiveJobs: number;
  coldStorageRecordsCount: number;
  departedStudentsCount: number;
  anonymizedProfilesCount: number;
  jobs: ArchiveJob[];
}

export const DataLifecycleManager: React.FC = () => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [summary, setSummary] = useState<LifecycleSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  // New Archive Job Modal
  const [showArchiveModal, setShowArchiveModal] = useState<boolean>(false);
  const [entityType, setEntityType] = useState<'access_logs' | 'bookings' | 'violations'>('access_logs');
  const [cutoffDate, setCutoffDate] = useState<string>('2025-08-01');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Student Departure Modal
  const [showDepartureModal, setShowDepartureModal] = useState<boolean>(false);
  const [departureMode, setDepartureMode] = useState<'csv' | 'manual'>('csv');
  const [departureReason, setDepartureReason] = useState<string>('Batch 2026 Graduation');
  const [departureManualInput, setDepartureManualInput] = useState<string>('');

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedStudentIds, setParsedStudentIds] = useState<string[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await api.get<LifecycleSummary>('/api/v1/archive/summary');
      if (data) {
        setSummary(data);
      }
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleCreateArchiveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await api.post<{ recordCount: number }>('/api/v1/archive/job', {
        entityType,
        cutoffDate,
      });

      const msg = `Cold storage archive created for ${entityType} (${data.recordCount} records).`;
      setNotification(msg);
      toast.success(msg);
      setShowArchiveModal(false);
      fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Archive Job Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Parse CSV / Excel File
  const handleProcessFile = (file: File) => {
    setCsvError(null);
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        let identifiers: string[] = [];

        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

          if (lines.length > 0) {
            // Check if header exists
            const header = lines[0].toLowerCase();
            const startIndex = header.includes('roll') || header.includes('student') || header.includes('email') || header.includes('id') ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
              if (parts[0]) {
                identifiers.push(parts[0]);
              }
            }
          }
        } else {
          // Excel format (.xlsx, .xls)
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

          if (rows.length > 0) {
            const firstRow = rows[0] as any[];
            let idColIndex = 0;

            if (Array.isArray(firstRow)) {
              firstRow.forEach((col, idx) => {
                const str = String(col).toLowerCase();
                if (str.includes('roll') || str.includes('student') || str.includes('email') || str.includes('id')) {
                  idColIndex = idx;
                }
              });
            }

            const startIndex = Array.isArray(firstRow) && firstRow.some((c) => String(c).toLowerCase().includes('roll')) ? 1 : 0;
            for (let i = startIndex; i < rows.length; i++) {
              const row = rows[i] as any[];
              if (row && row[idColIndex] !== undefined) {
                const val = String(row[idColIndex]).trim();
                if (val) identifiers.push(val);
              }
            }
          }
        }

        // Deduplicate
        const uniqueIds = Array.from(new Set(identifiers.filter(Boolean)));
        if (uniqueIds.length === 0) {
          setCsvError('No valid student roll numbers or IDs found in the file.');
          setParsedStudentIds([]);
        } else {
          setParsedStudentIds(uniqueIds);
          toast.info(`Parsed ${uniqueIds.length} student record(s) from ${file.name}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setCsvError(`Failed to parse file: ${msg}`);
        setParsedStudentIds([]);
      }
    };

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = 'roll_number,reason\n202101001,Graduation Batch 2026\n202101002,Graduation Batch 2026\n202101003,Graduation Batch 2026\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_departure_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessDeparture = async (e: React.FormEvent) => {
    e.preventDefault();

    let studentIds: string[] = [];
    if (departureMode === 'csv') {
      studentIds = parsedStudentIds;
      if (studentIds.length === 0) {
        toast.error('Please upload a CSV file with student roll numbers or IDs.');
        return;
      }
    } else {
      // Manual input: split by comma, newline, or whitespace
      studentIds = departureManualInput
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (studentIds.length === 0) {
        toast.error('Please enter at least one Student Roll Number, Email, or UUID.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const data = await api.post<{ message?: string; processedCount?: number }>('/api/v1/archive/departure', {
        studentIds,
        reason: departureReason.trim(),
      });

      const msg = data.message || `Processed departure for ${studentIds.length} student(s).`;
      setNotification(msg);
      toast.success(msg);
      setShowDepartureModal(false);
      setDepartureManualInput('');
      setParsedStudentIds([]);
      setCsvFile(null);
      fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Departure Processing Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Data Lifecycle, Retention & Cold Storage Archive
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Parquet/Zstandard Cold Storage • 7-Year Anonymization • Student Departure & Purge
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowDepartureModal(true);
                setCsvFile(null);
                setParsedStudentIds([]);
                setCsvError(null);
              }}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Process Student Departure</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowArchiveModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Archive Job</span>
            </Button>

            <IconButton
              label="Refresh lifecycle"
              size="sm"
              onClick={fetchSummary}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </IconButton>
          </div>
        </div>

        {notification && (
          <Alert tone="success" onDismiss={() => setNotification(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>{notification}</span>
            </div>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Archived Parquet Jobs"
            value={summary?.totalArchiveJobs || 0}
            hint="Cold storage files"
            icon={<Archive className="w-4 h-4 text-primary" />}
          />
          <Stat
            label="Cold Storage Records"
            value={summary?.coldStorageRecordsCount || 0}
            hint="Compressed row records"
            icon={<Database className="w-4 h-4 text-accent" />}
          />
          <Stat
            label="Departed Students Purged"
            value={summary?.departedStudentsCount || 0}
            hint="Biometric credentials purged"
            icon={<GraduationCap className="w-4 h-4 text-danger" />}
          />
          <Stat
            label="7-Year Anonymized"
            value={summary?.anonymizedProfilesCount || 0}
            hint="GDPR/Retention compliance"
            icon={<Database className="w-4 h-4 text-success" />}
          />
        </div>
      </Card>

      {/* Archive Jobs List */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base text-text">
            Cold Storage Archival Jobs & Compressed Parquet Bundles
          </h3>
        </div>

        {summary && summary.jobs.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-border-subtle/60 text-muted font-semibold">
                <tr>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Cutoff Date</th>
                  <th className="p-3">Record Count</th>
                  <th className="p-3">Storage Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {summary.jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-border-subtle/30 transition-colors">
                    <td className="p-3 font-bold uppercase text-text">{j.entityType}</td>
                    <td className="p-3 font-mono text-secondary">{j.cutoffDate}</td>
                    <td className="p-3 font-mono font-semibold text-success">{j.recordCount} rows</td>
                    <td className="p-3 font-mono text-muted truncate max-w-xs">{j.storagePath}</td>
                    <td className="p-3">
                      <Badge tone={j.status === 'completed' ? 'success' : 'warning'}>
                        {j.status}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-muted">{new Date(j.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Archive className="w-6 h-6" />}
            title="No Cold Archives Created"
            description="No historical cold archive jobs created yet. Run an archive job above to compress old logs into Parquet format."
          />
        )}
      </Card>

      {/* Archive Modal */}
      <Modal
        open={showArchiveModal}
        title="Create Cold Storage Archive (Parquet)"
        onClose={() => setShowArchiveModal(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowArchiveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleCreateArchiveJob}
            >
              Run Archive Job
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateArchiveJob} className="space-y-4 text-xs">
          <Select
            label="Entity Domain"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as any)}
          >
            <option value="access_logs">Turnstile Access & Entry Logs</option>
            <option value="bookings">Historical Slot Bookings</option>
            <option value="violations">Resolved Disciplinary Violations</option>
          </Select>

          <Input
            label="Cutoff Date (YYYY-MM-DD)"
            type="date"
            required
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
          />
        </form>
      </Modal>

      {/* Enhanced Departure Wizard Modal with CSV Import */}
      <Modal
        open={showDepartureModal}
        title="Student Departure & Access Termination"
        onClose={() => setShowDepartureModal(false)}
        wide
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowDepartureModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={submitting}
              disabled={departureMode === 'csv' ? parsedStudentIds.length === 0 : !departureManualInput.trim()}
              onClick={handleProcessDeparture}
            >
              Execute Departure {departureMode === 'csv' && parsedStudentIds.length > 0 ? `(${parsedStudentIds.length})` : ''}
            </Button>
          </>
        }
      >
        <form onSubmit={handleProcessDeparture} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-danger-muted/30 border border-danger/20 text-danger text-xs leading-relaxed">
            Processing departure marks student accounts as departed, revokes turnstile facial biometric templates, expires active memberships, and cancels future reservations.
          </div>

          <Input
            label="Departure Reason / Cohort"
            type="text"
            required
            placeholder="e.g. Batch 2026 Graduation"
            value={departureReason}
            onChange={(e) => setDepartureReason(e.target.value)}
          />

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-2 pt-1">
            <button
              type="button"
              onClick={() => setDepartureMode('csv')}
              className={cn(
                'px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all',
                departureMode === 'csv'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-elevated text-secondary hover:text-text'
              )}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import via CSV / Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setDepartureMode('manual')}
              className={cn(
                'px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all',
                departureMode === 'manual'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-elevated text-secondary hover:text-text'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manual Entry / Paste</span>
            </button>
          </div>

          {departureMode === 'csv' ? (
            <div className="space-y-3">
              {/* Drag & Drop Upload Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleProcessFile(f);
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleProcessFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all',
                  isDragging
                    ? 'border-primary bg-primary-muted/20'
                    : 'border-border hover:border-primary/50 hover:bg-surface-elevated/40'
                )}
              >
                <UploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-text text-sm">
                  {csvFile ? csvFile.name : 'Click or Drag & Drop Student Departure CSV / Excel'}
                </p>
                <p className="text-[11px] text-muted mt-1">
                  Supports .csv, .xlsx, .xls, .txt (containing Roll Numbers or Student UUIDs)
                </p>
              </div>

              {csvError && (
                <div className="p-3 rounded-xl bg-danger-muted/30 border border-danger/20 text-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Parsed Summary & Preview */}
              {parsedStudentIds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      {parsedStudentIds.length} Student Record(s) Ready to Depart
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setCsvFile(null);
                        setParsedStudentIds([]);
                      }}
                    >
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-elevated border border-border max-h-32 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {parsedStudentIds.map((id) => (
                        <span
                          key={id}
                          className="px-2 py-0.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-text"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Download Sample Template */}
              <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                <span>CSV Column format: `roll_number` or single list of roll numbers.</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Download Sample CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="font-semibold text-text">
                Enter Student Roll Numbers, UUIDs, or Emails
              </label>
              <textarea
                rows={4}
                required
                placeholder="Enter roll numbers separated by commas or new lines, e.g.:&#10;202101001&#10;202101002&#10;202101003"
                value={departureManualInput}
                onChange={(e) => setDepartureManualInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              />
              <p className="text-[11px] text-muted">
                You can paste multiple roll numbers separated by commas or newlines.
              </p>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
