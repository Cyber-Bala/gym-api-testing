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
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, EmptyState } from '../ui/primitives';
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
  const toast = useToast();
  const [selectedType, setSelectedType] = useState<string>('attendance');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await api.get<ReportData>('/api/v1/reports/generate', {
        params: { reportType: selectedType },
      });
      setReportData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Failed to Generate Report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedType]);

  const handleDownloadCsv = async () => {
    setDownloading(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `rec_gym_${selectedType}_report_${timestamp}.csv`;
      await api.downloadBlob(`/api/v1/reports/export-csv?reportType=${selectedType}`, filename);
      toast.success(`Exported ${filename} successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'CSV Export Failed');
    } finally {
      setDownloading(false);
    }
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
            Tabular Multi-Domain Reporting • Secure Authenticated CSV Export & Excel Formatting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            loading={downloading}
            className="border-primary/30 text-primary hover:bg-primary-muted"
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

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedType(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                isSelected
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-secondary hover:bg-border-subtle hover:text-text'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Summary KPI Cards if available */}
      {reportData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(reportData.summary).map(([key, val]) => (
            <div key={key} className="p-3.5 rounded-2xl border border-border bg-border-subtle/30 space-y-1">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="text-lg sm:text-xl font-black text-text">
                {typeof val === 'number' && key.toLowerCase().includes('revenue')
                  ? `₹${val.toLocaleString()}`
                  : String(val)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Report Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <span>Generating real-time institutional report...</span>
        </div>
      ) : !reportData || reportData.rows.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="w-6 h-6" />}
          title="No records found"
          description="There are currently no rows recorded for this report domain."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-border-subtle/60 border-b border-border text-muted font-bold uppercase tracking-wider text-[10px]">
                {reportData.columns.map((col) => (
                  <th key={col} className="py-3 px-4 whitespace-nowrap">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface">
              {reportData.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-border-subtle/40 transition-colors">
                  {reportData.columns.map((col) => {
                    const cellVal = row[col];
                    const isCurrency = col.toLowerCase().includes('amount') || col.toLowerCase().includes('price') || col.toLowerCase().includes('stipend');
                    return (
                      <td key={col} className="py-2.5 px-4 whitespace-nowrap text-secondary font-medium">
                        {isCurrency && typeof cellVal === 'number'
                          ? `₹${cellVal}`
                          : cellVal !== undefined && cellVal !== null
                          ? String(cellVal)
                          : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportData && (
        <div className="flex items-center justify-between text-[11px] text-muted pt-2">
          <span>Generated At: {new Date(reportData.generatedAt).toLocaleString()}</span>
          <span className="font-mono">{reportData.totalRecords} total records</span>
        </div>
      )}
    </Card>
  );
};
