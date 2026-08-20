import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Modal, Alert } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

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
  const toast = useToast();
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
      const data = await api.get<AuthorizedPersonItem[]>('/api/v1/people/authorized-persons');
      setList(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg, 'Failed to Load Guest Directory');
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
      await api.post('/api/v1/people/authorized-persons', {
        name,
        email,
        phone: phone || undefined,
        designation,
        notes: notes || undefined,
      });

      toast.success(`VIP Guest Access provisioned for ${name}.`);
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
      toast.error(msg, 'Provisioning Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, personName: string) => {
    const reason = prompt(`Enter reason for revoking access for ${personName}:`, 'Administrative revocation');
    if (!reason) return;

    try {
      await api.post(`/api/v1/people/authorized-persons/${id}/revoke`, { reason });
      toast.success(`Access revoked for ${personName}.`);
      fetchList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Revocation Failed');
    }
  };

  return (
    <Card className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-text flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <span>Authorized Persons Management</span>
          </h3>
          <p className="text-xs text-secondary">
            VIP Trustees, Executives, and Contractors exempt from membership fees and slot quotas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            label="Refresh authorized list"
            size="sm"
            onClick={fetchList}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Grant VIP Access</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" onDismiss={() => setError(null)}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-border-subtle/50 text-muted font-semibold border-b border-border">
            <tr>
              <th className="py-3 px-4">Authorized Person</th>
              <th className="py-3 px-4">Designation</th>
              <th className="py-3 px-4">Contact Phone</th>
              <th className="py-3 px-4">Notes</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-text">
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  {loading ? 'Loading authorized persons...' : 'No authorized persons provisioned'}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-border-subtle/30 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-text">{item.name}</p>
                    <p className="text-[11px] text-muted font-mono">{item.email}</p>
                  </td>
                  <td className="py-3 px-4 font-medium text-text">{item.designation}</td>
                  <td className="py-3 px-4 font-mono text-secondary">{item.phone || '—'}</td>
                  <td className="py-3 px-4 text-muted max-w-xs truncate">{item.notes || '—'}</td>
                  <td className="py-3 px-4">
                    {item.revokedAt ? (
                      <Badge tone="danger">Revoked</Badge>
                    ) : (
                      <Badge tone="success">
                        <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Active
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!item.revokedAt && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRevoke(item.id, item.name)}
                        className="text-danger hover:bg-danger-muted/30"
                      >
                        Revoke Access
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal
        open={modalOpen}
        title="Provision Authorized Person (VIP Access)"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleCreate}
            >
              Confirm Access
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
          <Input
            label="Full Name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mr. K. Vijay"
          />

          <Input
            label="College / Work Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. vijay.trustee@rajalakshmi.edu.in"
          />

          <Input
            label="Designation / Role"
            type="text"
            required
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. College Trustee / External Fitness Auditor"
          />

          <Input
            label="Phone Number"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919876543210"
          />

          <Textarea
            label="Special Access Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special access notes or institutional approvals..."
            rows={2}
          />
        </form>
      </Modal>
    </Card>
  );
};

