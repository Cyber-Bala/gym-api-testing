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
  Eye,
  Search,
  Copy,
  Check,
  FileText,
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
  const [entityType, setEntityType] = useState<'access_logs' | 'bookings' | 'violations' | 'payments'>('access_logs');
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

  // Data Inspection Modal State
  const [selectedJob, setSelectedJob] = useState<ArchiveJob | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [jobRecords, setJobRecords] = useState<Array<Record<string, any>>>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Inspect Archive Data
  const handleInspectJob = async (job: ArchiveJob) => {
    setSelectedJob(job);
    setInspectLoading(true);
    setJobRecords([]);
    setSearchQuery('');
    try {
      const res = await api.get<{ job: ArchiveJob; records: Array<Record<string, any>> }>(
        `/api/v1/archive/job/${job.id}/records`
      );
      if (res?.records) {
        setJobRecords(res.records);
      }
    } catch {
      toast.error('Failed to load records for this archive bundle');
    } finally {
      setInspectLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = (job: ArchiveJob, records: Array<Record<string, any>>) => {
    if (!records || records.length === 0) {
      toast.error('No records available to export');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, job.entityType);
    XLSX.writeFile(wb, `gym_archive_${job.entityType}_${job.cutoffDate}.xlsx`);
    toast.success(`Exported ${records.length} records to Excel (.xlsx)`);
  };

  // Export to CSV
  const handleExportCSV = (job: ArchiveJob, records: Array<Record<string, any>>) => {
    if (!records || records.length === 0) {
      toast.error('No records available to export');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(records);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gym_archive_${job.entityType}_${job.cutoffDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${records.length} records to CSV (.csv)`);
  };

  // Copy MinIO Path
  const handleCopyPath = (path: string, id: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    toast.success('MinIO S3 storage URI copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
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

        const unique = Array.from(new Set(identifiers));
        if (unique.length === 0) {
          setCsvError('No student identifiers or roll numbers found in the uploaded file.');
        } else {
          setParsedStudentIds(unique);
        }
      } catch (err) {
        setCsvError('Failed to parse file. Please ensure it is a valid CSV or Excel file.');
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = 'roll_number,name,department\n202101001,John Doe,CSE\n202101002,Jane Smith,ECE\n202101003,Alex Brown,MECH';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_student_departure_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let idsToProcess: string[] = [];
    if (departureMode === 'csv') {
      idsToProcess = parsedStudentIds;
    } else {
      idsToProcess = departureManualInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (idsToProcess.length === 0) {
      toast.error('No student IDs or roll numbers provided');
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.post<{ processedCount: number; message: string }>('/api/v1/archive/departure', {
        studentIds: idsToProcess,
        reason: departureReason,
      });

      const msg = res.message || `${res.processedCount} students marked departed and credentials purged.`;
      setNotification(msg);
      toast.success(msg);
      setShowDepartureModal(false);
      setCsvFile(null);
      setParsedStudentIds([]);
      setDepartureManualInput('');
      fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Departure Process Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter records in inspector modal
  const filteredRecords = jobRecords.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(rec).some((val) => String(val).toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Data Retention & Cold Storage Archive</h2>
          <p className="text-xs text-secondary mt-0.5">
            Immutable Parquet Cold Storage • 7-Year Retention & PII Anonymization • Student Departure & Purge
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDepartureModal(true)}
          >
            <GraduationCap className="w-4 h-4 mr-1.5" />
            Process Student Departure
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowArchiveModal(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Archive Job
          </Button>

          <IconButton
            label="Refresh lifecycle"
            size="sm"
            onClick={fetchSummary}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </IconButton>
        </div>
      </div>

      {notification && (
        <Alert tone="success" onDismiss={() => setNotification(null)}>
          {notification}
        </Alert>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Total Archive Bundles"
          value={summary?.totalArchiveJobs || 0}
          icon={<Archive className="w-5 h-5 text-primary" />}
          hint="S3 Parquet cold archive jobs"
        />
        <Stat
          label="Cold Storage Records"
          value={summary?.coldStorageRecordsCount || 0}
          icon={<Database className="w-5 h-5 text-warning" />}
          hint="Compressed row records"
        />
        <Stat
          label="Departed Students Purged"
          value={summary?.departedStudentsCount || 0}
          icon={<GraduationCap className="w-5 h-5 text-danger" />}
          hint="Biometric credentials purged"
        />
        <Stat
          label="7-Year Anonymized"
          value={summary?.anonymizedProfilesCount || 0}
          icon={<Database className="w-5 h-5 text-success" />}
          hint="GDPR/Retention compliance"
        />
      </div>

      {/* Cold Storage Jobs Table */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base text-text">
              Jobs & Compressed Parquet Bundles
            </h3>
          </div>
          <span className="text-xs text-muted">
            {summary?.jobs.length || 0} Archives stored in MinIO
          </span>
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
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {summary.jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-border-subtle/30 transition-colors">
                    <td className="p-3 font-bold uppercase text-text">{j.entityType}</td>
                    <td className="p-3 font-mono text-secondary">{j.cutoffDate}</td>
                    <td className="p-3 font-mono font-semibold text-success">{j.recordCount} rows</td>
                    <td className="p-3 font-mono text-muted">
                      <div className="flex items-center gap-1.5 max-w-xs">
                        <span className="truncate">{j.storagePath}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPath(j.storagePath, j.id)}
                          className="text-muted hover:text-primary shrink-0 transition-colors p-1"
                          title="Copy MinIO S3 path"
                        >
                          {copiedId === j.id ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge tone={j.status === 'completed' ? 'success' : 'warning'}>
                        {j.status}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-muted">{new Date(j.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleInspectJob(j)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-primary" />
                          View Data
                        </Button>
                      </div>
                    </td>
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
            <option value="payments">Financial Membership Orders</option>
          </Select>

          <Input
            label="Cutoff Date (YYYY-MM-DD)"
            type="date"
            required
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
          />
          <p className="text-[11px] text-muted">
            All records created on or before this cutoff date will be compressed into `.parquet.zst` format in MinIO cold storage.
          </p>
        </form>
      </Modal>

      {/* Interactive Data Inspector & Exporter Modal */}
      {selectedJob && (
        <Modal
          open={Boolean(selectedJob)}
          title={`Archive Inspector: ${selectedJob.entityType.toUpperCase()} (Cutoff: ${selectedJob.cutoffDate})`}
          onClose={() => setSelectedJob(null)}
          wide
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportExcel(selectedJob, jobRecords)}
                  disabled={jobRecords.length === 0}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-success" />
                  Export to Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV(selectedJob, jobRecords)}
                  disabled={jobRecords.length === 0}
                >
                  <Download className="w-4 h-4 mr-1.5 text-primary" />
                  Export to CSV (.csv)
                </Button>
              </div>

              <Button variant="secondary" size="sm" onClick={() => setSelectedJob(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Storage Info Banner */}
            <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-muted text-[11px]">Storage URI (MinIO Object Store):</span>
                <p className="font-mono text-text font-semibold break-all text-xs">
                  {selectedJob.storagePath}
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleCopyPath(selectedJob.storagePath, 'modal')}
              >
                {copiedId === 'modal' ? (
                  <span className="text-success font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Copied
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" /> Copy URI
                  </span>
                )}
              </Button>
            </div>

            {/* Search & Stats Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student, roll number, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-border text-text placeholder:text-muted text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>

              <span className="text-muted text-xs font-medium">
                Showing {filteredRecords.length} of {jobRecords.length} records
              </span>
            </div>

            {/* Table or Loading / Empty state */}
            {inspectLoading ? (
              <div className="py-12 text-center text-muted flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Reading and deserializing cold archive records...</span>
              </div>
            ) : filteredRecords.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-border-subtle/60 text-muted font-semibold sticky top-0 bg-surface-elevated z-10">
                    <tr>
                      {Object.keys(filteredRecords[0]).map((key) => (
                        <th key={key} className="p-2.5 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text font-mono">
                    {filteredRecords.map((row, idx) => (
                      <tr key={idx} className="hover:bg-border-subtle/30 transition-colors">
                        {Object.entries(row).map(([k, val], valIdx) => (
                          <td key={valIdx} className="p-2.5 whitespace-nowrap">
                            {k.toLowerCase().includes('status') ? (
                              <Badge
                                tone={
                                  String(val) === 'inside' || String(val) === 'booked' || String(val) === 'paid'
                                    ? 'success'
                                    : String(val) === 'exited'
                                    ? 'neutral'
                                    : 'warning'
                                }
                              >
                                {String(val)}
                              </Badge>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted">
                <FileText className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-text">No records matched your search query</p>
                <p className="text-[11px] text-muted mt-1">Try clearing your search filter.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

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
