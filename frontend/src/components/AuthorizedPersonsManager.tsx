import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, RefreshCw, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AuthorizedPersonItem {
  id: string;
  personId: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string;
  notes: string | null;
  status: string;
  revokedAt: string | null;
  createdAt: string;
}

export const AuthorizedPersonsManager: React.FC = () => {
  const [list, setList] = useState<AuthorizedPersonItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/people/authorized-persons', {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to load authorized persons');
      setList(data.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/people/authorized-persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, designation, notes }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to provision authorized person');

      setModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setDesignation('');
      setNotes('');
      fetchList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, personName: string) => {
    const reason = prompt(`Enter reason for revoking access for ${personName}:`, 'Administrative revocation');
    if (!reason) return;

    try {
      const res = await fetch(`/api/v1/people/authorized-persons/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to revoke access');

      fetchList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  };

  return (
    <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-rec-gold" />
            Authorized Persons Management
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            VIP Trustees, Owners, and Contractors exempt from membership fees and slot quotas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchList}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-medium text-xs shadow-md shadow-rec-purple/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Grant VIP Access</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-[#202024] text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="py-3 px-4">Authorized Person</th>
              <th className="py-3 px-4">Designation</th>
              <th className="py-3 px-4">Contact Phone</th>
              <th className="py-3 px-4">Notes</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-gray-700 dark:text-gray-300">
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  {loading ? 'Loading authorized persons...' : 'No authorized persons provisioned'}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{item.email}</p>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">{item.designation}</td>
                  <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-400">{item.phone || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{item.notes || '—'}</td>
                  <td className="py-3 px-4">
                    {item.revokedAt ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40">
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!item.revokedAt && (
                      <button
                        onClick={() => handleRevoke(item.id, item.name)}
                        className="px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium text-[11px] transition-colors"
                      >
                        Revoke Access
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-base text-gray-900 dark:text-white">Provision Authorized Person</h4>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mr. K. Vijay"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">College / Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. vijay.trustee@rajalakshmi.edu.in"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Designation / Role</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. College Trustee / External Fitness Auditor"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special access notes or authorizations..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-rec-purple text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Granting...' : 'Confirm Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
