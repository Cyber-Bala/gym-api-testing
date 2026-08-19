import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  TrendingUp,
  Users,
  CreditCard,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { Card } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { cn } from '../lib/cn';

interface ReportData {
  reportType: string;
  generatedAt: string;
  totalRecords: number;
  columns: string[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
}

export const ReportsCenter: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('attendance');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/reports/generate?reportType=${selectedType}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data.data);
      }
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedType]);

  const handleDownloadCsv = () => {
    window.open(`/api/v1/reports/export-csv?reportType=${selectedType}`, '_blank');
  };

  const reportTabs = [
    { id: 'attendance', label: 'Attendance & Check-Ins', icon: Users },
    { id: 'revenue', label: 'Day Scholar Revenue', icon: CreditCard },
    { id: 'violations', label: 'Violations & Penalties', icon: AlertTriangle },
    { id: 'payroll', label: 'Trainer Stipend Payroll', icon: Award },
    { id: 'access_logs', label: 'Turnstile Device Logs', icon: TrendingUp },
  ];

  return (
    <Card className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base sm:text-lg text-text">
              Institutional Reports & Multi-Format Data Export
            </h3>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Tabular Multi-Domain Reporting • Instant CSV Export & Excel Formatting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={handleDownloadCsv}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <IconButton
            label="Refresh report"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedType(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors',
                isSelected
                  ? 'bg-primary text-white dark:text-slate-950 shadow-sm'
                  : 'bg-surface border border-border text-secondary hover:text-text hover:bg-border-subtle/40'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Summary Card */}
      {reportData?.summary && (
        <div className="p-4 rounded-2xl border border-border bg-border-subtle/30 flex items-center justify-between text-xs">
          <span className="font-semibold text-secondary">Executive Summary Metric:</span>
          <div className="flex gap-4">
            {Object.entries(reportData.summary).map(([k, v]) => (
              <span key={k} className="font-bold text-primary text-sm">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Report Table Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
            {reportData?.reportType} ({reportData?.totalRecords || 0} Records)
          </h4>
          <span className="text-[10px] text-muted font-mono">
            Generated: {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleTimeString() : ''}
          </span>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-xs text-left">
            <thead className="bg-border-subtle/60 text-muted font-semibold sticky top-0">
              <tr>
                {reportData?.columns.map((col) => (
                  <th key={col} className="p-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text">
              {reportData && reportData.rows.length > 0 ? (
                reportData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-border-subtle/30 transition-colors">
                    {reportData.columns.map((col) => (
                      <td key={col} className="p-3 whitespace-nowrap font-mono text-secondary">
                        {row[col] !== undefined ? String(row[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={reportData?.columns.length || 1} className="p-8 text-center text-muted">
                    No records found for current report filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

