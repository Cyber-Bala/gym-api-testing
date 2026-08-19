import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';

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
  const [importType, setImportType] = useState<'students' | 'staff'>('students');
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<IngestionResultReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    window.open(`/api/v1/people/template/${importType}`, '_blank');
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

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
        credentials: 'include',
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error?.message || 'Failed to process import');
      }

      setReport(resData.data);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
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
          // Intentionally malformed row to showcase validation engine
          'Roll Number': 'INVALID_ROW',
          'Full Name': 'Incomplete Record',
          'College Email': 'bad-email-format',
          Department: '',
          'Joining Year': 1995,
        },
      ];

      const res = await fetch('/api/v1/people/import/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mockBatch }),
        credentials: 'include',
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error?.message || 'Quick import failed');

      setReport(resData.data);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 lg:p-8 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Bulk Data Ingestion</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Institutional Excel Student & Staff Roster Onboarding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setImportType('students');
              setReport(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              importType === 'students'
                ? 'bg-rec-purple text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            Student Directory Import
          </button>
          <button
            onClick={() => {
              setImportType('staff');
              setReport(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              importType === 'staff'
                ? 'bg-rec-purple text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            Faculty & Staff Import
          </button>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1: Download Template */}
          <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-rec-purple dark:text-rec-gold">
                Step 1
              </span>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mt-1">
                Official Excel Template
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Includes required headers (Roll No, Email, Residency, Department) with sample rows.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-xs font-medium text-gray-800 dark:text-gray-200 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span>Download {importType === 'students' ? 'Students' : 'Staff'} Template (.xlsx)</span>
            </button>
          </div>

          {/* Step 2: Upload Excel */}
          <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-rec-purple dark:text-rec-gold">
                Step 2
              </span>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mt-1">
                Upload & Process Roster
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white text-xs font-medium cursor-pointer transition-colors ${
                  loading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <UploadCloud className="w-4 h-4 text-rec-gold" />
                <span>{loading ? 'Processing...' : 'Upload Excel File'}</span>
              </label>

              {importType === 'students' && (
                <button
                  onClick={handleSampleQuickImport}
                  disabled={loading}
                  title="Test bulk ingestion with sample batch including a malformed record"
                  className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
                >
                  <FileCheck className="w-4 h-4 text-amber-500" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Ingestion Interrupted</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results Report Card */}
        {report && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ingestion Summary Report
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {report.successfulRows} of {report.totalRows} records provisioned
              </span>
            </div>

            {/* Scorecard */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 text-center">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Total Scanned</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{report.totalRows}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-center">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Successfully Provisioned</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{report.successfulRows}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-center">
                <p className="text-[11px] text-red-700 dark:text-red-300">Failed / Rejected</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{report.failedRows}</p>
              </div>
            </div>

            {/* Errors List */}
            {report.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Itemized Rejection Log (Non-destructive processing):
                </p>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-16">Row #</th>
                        <th className="py-2 px-3 w-32">Identifier</th>
                        <th className="py-2 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                      {report.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-red-50/50 dark:hover:bg-red-950/20">
                          <td className="py-2 px-3 font-mono font-bold text-red-600 dark:text-red-400">
                            {err.row}
                          </td>
                          <td className="py-2 px-3 font-mono">{err.identifier || '—'}</td>
                          <td className="py-2 px-3">{err.reason}</td>
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
    </div>
  );
};
