import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  UploadCloud,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { Modal, Badge, Alert, Stat } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface RowValidationError {
  row: number;
  identifier?: string;
  field?: string;
  reason: string;
}

interface IngestionResultReport {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: RowValidationError[];
  successfulIds: string[];
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const [importType, setImportType] = useState<'students' | 'staff'>('students');
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<IngestionResultReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      await api.downloadBlob(
        `/api/v1/people/template/${importType}`,
        `rec_${importType}_import_template.csv`
      );
      toast.success(`Downloaded ${importType} spreadsheet template!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Template Download Failed');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rows.length === 0) {
        throw new Error('Excel sheet contains no data rows');
      }

      const endpoint = importType === 'students' ? '/api/v1/people/import/students' : '/api/v1/people/import/staff';

      const resData = await api.post<IngestionResultReport>(endpoint, { rows });

      setReport(resData);
      toast.success(`Import completed: ${resData.successfulRows} row(s) added.`);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg, 'Import Error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSampleQuickImport = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const mockBatch = [
        {
          'Roll Number': `2024CS${Math.floor(100 + Math.random() * 800)}`,
          'Full Name': 'Sanjay Varma',
          'College Email': `sanjay.${Math.floor(100 + Math.random() * 800)}@rajalakshmi.edu.in`,
          Department: 'Computer Science and Engineering',
          'Joining Year': 2024,
          'Residency (hosteller / day_scholar)': 'hosteller',
          'Emergency Contact': '+919876512345',
        },
        {
          'Roll Number': `2024IT${Math.floor(100 + Math.random() * 800)}`,
          'Full Name': 'Ananya Krishnan',
          'College Email': `ananya.${Math.floor(100 + Math.random() * 800)}@rajalakshmi.edu.in`,
          Department: 'Information Technology',
          'Joining Year': 2024,
          'Residency (hosteller / day_scholar)': 'day_scholar',
          'Emergency Contact': '+919876554321',
        },
        {
          // Malformed record to test validation
          'Roll Number': 'INVALID_ROW',
          'Full Name': 'Incomplete Record',
          'College Email': 'bad-email-format',
          Department: '',
          'Joining Year': 1995,
        },
      ];

      const resData = await api.post<IngestionResultReport>('/api/v1/people/import/students', {
        rows: mockBatch,
      });

      setReport(resData);
      toast.success('Sample batch simulated and validated.');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg, 'Sample Import Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      title="Bulk Data Ingestion (Excel Roster)"
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {/* Tab Selection */}
        <div className="flex gap-2 p-1 bg-border-subtle rounded-xl border border-border">
          <button
            type="button"
            onClick={() => {
              setImportType('students');
              setReport(null);
            }}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors',
              importType === 'students'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-text'
            )}
          >
            Student Directory Import
          </button>
          <button
            type="button"
            onClick={() => {
              setImportType('staff');
              setReport(null);
            }}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors',
              importType === 'staff'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-text'
            )}
          >
            Faculty & Staff Import
          </button>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Step 1: Download Template */}
          <div className="p-5 rounded-2xl border border-border bg-border-subtle/30 flex flex-col justify-between space-y-3">
            <div>
              <Badge tone="primary">Step 1</Badge>
              <h4 className="font-bold text-sm text-text mt-1.5">
                Official Excel Template
              </h4>
              <p className="text-xs text-secondary mt-1">
                Includes required headers (Roll No, Email, Residency, Department) with verified sample rows.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadTemplate}
              className="w-full"
            >
              <Download className="w-4 h-4 text-success" />
              <span>Download {importType === 'students' ? 'Students' : 'Staff'} Template</span>
            </Button>
          </div>

          {/* Step 2: Upload Excel */}
          <div className="p-5 rounded-2xl border border-border bg-border-subtle/30 flex flex-col justify-between space-y-3">
            <div>
              <Badge tone="accent">Step 2</Badge>
              <h4 className="font-bold text-sm text-text mt-1.5">
                Upload & Process Roster
              </h4>
              <p className="text-xs text-secondary mt-1">
                Direct validation engine checking duplicates, roll numbers, and residency.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-file-input"
              />
              <label
                htmlFor="excel-file-input"
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold text-xs h-9 px-3 cursor-pointer transition-all hover:bg-primary-hover shadow-sm dark:text-slate-950',
                  loading && 'opacity-50 pointer-events-none'
                )}
              >
                <UploadCloud className="w-4 h-4 text-accent" />
                <span>{loading ? 'Processing...' : 'Upload Excel File'}</span>
              </label>

              {importType === 'students' && (
                <IconButton
                  label="Test sample batch"
                  size="sm"
                  onClick={handleSampleQuickImport}
                  disabled={loading}
                >
                  <FileCheck className="w-4 h-4 text-warning" />
                </IconButton>
              )}
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <Alert tone="danger" onDismiss={() => setError(null)}>
            <div className="space-y-0.5">
              <p className="font-bold">Ingestion Interrupted</p>
              <p>{error}</p>
            </div>
          </Alert>
        )}

        {/* Results Report Card */}
        {report && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-text flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" /> Ingestion Summary Report
              </h4>
              <span className="text-xs text-muted">
                {report.successfulRows} of {report.totalRows} records provisioned
              </span>
            </div>

            {/* Scorecard */}
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Total Scanned"
                value={report.totalRows}
              />
              <Stat
                label="Provisioned"
                value={report.successfulRows}
                className="border-success/30 bg-success-muted/20"
              />
              <Stat
                label="Rejected"
                value={report.failedRows}
                className="border-danger/30 bg-danger-muted/20"
              />
            </div>

            {/* Errors List */}
            {report.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Itemized Rejection Log:
                </p>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-border-subtle/60 text-muted font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-16">Row #</th>
                        <th className="py-2 px-3 w-32">Identifier</th>
                        <th className="py-2 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text">
                      {report.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-danger-muted/10 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-danger">
                            {err.row}
                          </td>
                          <td className="py-2 px-3 font-mono text-muted">{err.identifier || '—'}</td>
                          <td className="py-2 px-3 text-secondary">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

