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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Institutional Reports & Multi-Format Data Export
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tabular Multi-Domain Reporting (SRS REP-001..014) • Instant CSV Export & Excel Formatting
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchReport}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh report"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Report Type Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          {[
            { id: 'attendance', label: 'Attendance & Check-Ins', icon: Users },
            { id: 'revenue', label: 'Day Scholar Revenue', icon: CreditCard },
            { id: 'violations', label: 'Violations & Penalties', icon: AlertTriangle },
            { id: 'payroll', label: 'Trainer Stipend Payroll', icon: Award },
            { id: 'access_logs', label: 'Turnstile Device Logs', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-rec-purple text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Summary Card */}
        {reportData?.summary && (
          <div className="p-4 rounded-2xl bg-rec-purple-50/40 dark:bg-rec-purple-950/20 border border-rec-purple-200 dark:border-rec-purple-800/40 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Executive Summary Metric:</span>
            {Object.entries(reportData.summary).map(([k, v]) => (
              <span key={k} className="font-bold text-rec-purple dark:text-rec-gold text-sm">
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {/* Report Table Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {reportData?.reportType} ({reportData?.totalRecords || 0} Records)
            </h4>
            <span className="text-[10px] text-gray-400 font-mono">
              Generated: {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleTimeString() : ''}
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500 sticky top-0">
                <tr>
                  {reportData?.columns.map((col) => (
                    <th key={col} className="p-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {reportData && reportData.rows.length > 0 ? (
                  reportData.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                      {reportData.columns.map((col) => (
                        <td key={col} className="p-3 whitespace-nowrap font-mono text-gray-800 dark:text-gray-200">
                          {row[col] !== undefined ? String(row[col]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={reportData?.columns.length || 1} className="p-8 text-center text-gray-400">
                      No records found for current report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
