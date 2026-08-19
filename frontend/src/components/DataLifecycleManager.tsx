import React, { useState, useEffect } from 'react';
import {
  Archive,
  Database,
  GraduationCap,
  RefreshCw,
  Plus,
  CheckCircle2,
  X,
} from 'lucide-react';

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
  const [departureReason, setDepartureReason] = useState<string>('Batch 2026 Graduation');
  const [departureStudentId, setDepartureStudentId] = useState<string>('');

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/archive/summary', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data.data);
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
      const res = await fetch('/api/v1/archive/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, cutoffDate }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Archive job failed');

      setNotification(`Cold storage parquet archive created for ${entityType} (${data.data.recordCount} records).`);
      setShowArchiveModal(false);
      fetchSummary();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const studentIds = departureStudentId ? [departureStudentId] : ['11111111-1111-1111-1111-111111111111'];
      const res = await fetch('/api/v1/archive/departure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds,
          reason: departureReason,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Departure processing failed');

      setNotification(data.data.message || 'Student departures processed.');
      setShowDepartureModal(false);
      setDepartureStudentId('');
      fetchSummary();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Data Lifecycle, Retention & Cold Storage Archive
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Parquet/Zstandard Cold Storage (ADR-019) • 7-Year Anonymization • Student Departure & Credential Purge
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDepartureModal(true)}
              className="px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center gap-1"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Process Student Departure</span>
            </button>

            <button
              onClick={() => setShowArchiveModal(true)}
              className="px-3 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rec-purple/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Archive Job</span>
            </button>

            <button
              onClick={fetchSummary}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh lifecycle"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {notification && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
            <span className="text-[11px] text-gray-500">Archived Parquet Jobs</span>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white">
              {summary?.totalArchiveJobs || 0}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
            <span className="text-[11px] text-gray-500">Cold Storage Records</span>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white">
              {summary?.coldStorageRecordsCount || 0}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
            <span className="text-[11px] text-gray-500">Departed Students Purged</span>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white">
              {summary?.departedStudentsCount || 0}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
            <span className="text-[11px] text-gray-500">7-Year Anonymized Profiles</span>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white">
              {summary?.anonymizedProfilesCount || 0}
            </h4>
          </div>
        </div>
      </div>

      {/* Archive Jobs List */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
          <h3 className="font-bold text-base text-gray-900 dark:text-white">
            Cold Storage Archival Jobs & Compressed Parquet Bundles
          </h3>
        </div>

        {summary && summary.jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500">
                <tr>
                  <th className="p-3 rounded-l-xl">Entity</th>
                  <th className="p-3">Cutoff Date</th>
                  <th className="p-3">Record Count</th>
                  <th className="p-3">Storage Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 rounded-r-xl">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="p-3 font-bold uppercase text-gray-900 dark:text-white">{j.entityType}</td>
                    <td className="p-3 font-mono">{j.cutoffDate}</td>
                    <td className="p-3 font-mono font-semibold text-emerald-600">{j.recordCount} rows</td>
                    <td className="p-3 font-mono text-gray-400 truncate max-w-xs">{j.storagePath}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold uppercase">
                        {j.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-gray-400">{new Date(j.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
            No historical cold archive jobs created yet.
          </div>
        )}
      </div>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Create Cold Storage Archive</h4>
              <button onClick={() => setShowArchiveModal(false)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateArchiveJob} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Entity Domain</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                >
                  <option value="access_logs">Turnstile Access & Entry Logs</option>
                  <option value="bookings">Historical Slot Bookings</option>
                  <option value="violations">Resolved Disciplinary Violations</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Cutoff Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Archiving...' : 'Run Archive Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Departure Wizard Modal */}
      {showDepartureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-red-600">Student Departure & Access Termination</h4>
              <button onClick={() => setShowDepartureModal(false)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessDeparture} className="space-y-3 text-xs">
              <p className="text-gray-600 dark:text-gray-300">
                Processing departure marks student accounts as departed, revokes turnstile facial biometric templates, expires memberships, and cancels active reservations.
              </p>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Departure Reason / Cohort
                </label>
                <input
                  type="text"
                  required
                  value={departureReason}
                  onChange={(e) => setDepartureReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Target Student UUID (Leave blank for default batch)
                </label>
                <input
                  type="text"
                  placeholder="Enter Student UUID or leave blank"
                  value={departureStudentId}
                  onChange={(e) => setDepartureStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepartureModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Execute Departure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
