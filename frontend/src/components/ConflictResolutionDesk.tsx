import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  X,
  Check,
} from 'lucide-react';

interface ConflictItem {
  id: string;
  personId?: string;
  name?: string;
  eventType: string;
  deviceId: string;
  result: string;
  denialReason?: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export const ConflictResolutionDesk: React.FC = () => {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Resolve Modal
  const [resolvingConflict, setResolvingConflict] = useState<ConflictItem | null>(null);
  const [resolutionType, setResolutionType] = useState<'dismissed' | 'overridden' | 'penalty_applied'>('overridden');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/conflicts/list', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setConflicts(data.data || []);
      }
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingConflict) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/conflicts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId: resolvingConflict.id,
          resolution: resolutionType,
          notes: resolutionNotes,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Resolution failed');

      setNotification(`Conflict resolved as '${resolutionType}'. Logged to institutional audit trail.`);
      setResolvingConflict(null);
      setResolutionNotes('');
      fetchConflicts();
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
              <ShieldAlert className="w-5 h-5 text-red-500 dark:text-red-400" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Turnstile Security & Operational Conflict Desk
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Anti-Pass-Back Alerts (ADR-014) • Hardware Access Denials • Administrative Overrides & CCTV Audit
            </p>
          </div>

          <button
            onClick={fetchConflicts}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title="Refresh conflicts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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

        {/* Conflicts List */}
        {conflicts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-1">
            <Check className="w-6 h-6 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Zero Turnstile Conflicts</h4>
            <p className="text-xs text-gray-500">All turnstile scans and Anti-Pass-Back validations are passing cleanly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-red-50/30 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{c.name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                      Security Alert
                    </span>
                  </div>

                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{c.denialReason}</p>
                  <p className="text-[11px] text-gray-500">
                    Device: {c.deviceId} • {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setResolvingConflict(c)}
                    className="px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Resolve Conflict
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {resolvingConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                Resolve Access Conflict
              </h4>
              <button onClick={() => setResolvingConflict(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Resolution Decision
                </label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                >
                  <option value="overridden">Administrative Override (False Alarm / Gate Glitch)</option>
                  <option value="dismissed">Dismissed (User departed floor)</option>
                  <option value="penalty_applied">Penalty Strike Applied (Anti-Pass-Back Sharing)</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Audit Notes / Reason
                </label>
                <textarea
                  required
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. CCTV verified student tapped twice on entrance turnstile"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingConflict(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
