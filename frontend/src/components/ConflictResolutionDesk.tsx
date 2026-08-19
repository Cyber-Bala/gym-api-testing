import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Select, Textarea } from '../ui/Input';
import { cn } from '../lib/cn';

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
    <Card className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-danger" />
            <h3 className="font-bold text-base sm:text-lg text-text">
              Turnstile Security & Operational Conflict Desk
            </h3>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Anti-Pass-Back Alerts • Hardware Access Denials • Administrative Overrides & CCTV Audit
          </p>
        </div>

        <IconButton
          label="Refresh conflicts"
          size="sm"
          onClick={fetchConflicts}
          disabled={loading}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </IconButton>
      </div>

      {notification && (
        <Alert tone="success" onDismiss={() => setNotification(null)}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{notification}</span>
          </div>
        </Alert>
      )}

      {/* Conflicts List */}
      {conflicts.length === 0 ? (
        <EmptyState
          icon={<Check className="w-6 h-6 text-success" />}
          title="Zero Turnstile Conflicts"
          description="All turnstile scans and Anti-Pass-Back validations are passing cleanly across lanes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {conflicts.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-2xl bg-danger-muted/20 border border-danger/30 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-text">{c.name || 'Unidentified User'}</span>
                  <Badge tone="danger">Security Alert</Badge>
                </div>

                <p className="text-xs text-danger font-semibold">{c.denialReason}</p>
                <p className="text-[11px] text-muted">
                  Device: {c.deviceId} • {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => setResolvingConflict(c)}
                >
                  Resolve Conflict
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      <Modal
        open={Boolean(resolvingConflict)}
        title="Resolve Access Conflict"
        onClose={() => setResolvingConflict(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setResolvingConflict(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleResolve}
            >
              Confirm Resolution
            </Button>
          </>
        }
      >
        <form onSubmit={handleResolve} className="space-y-4 text-xs">
          <Select
            label="Resolution Decision"
            value={resolutionType}
            onChange={(e) => setResolutionType(e.target.value as any)}
          >
            <option value="overridden">Administrative Override (False Alarm / Gate Glitch)</option>
            <option value="dismissed">Dismissed (User departed floor)</option>
            <option value="penalty_applied">Penalty Strike Applied (Anti-Pass-Back Sharing)</option>
          </Select>

          <Textarea
            label="Audit Notes / Reason"
            required
            rows={2}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="e.g. CCTV verified student tapped twice on entrance turnstile"
          />
        </form>
      </Modal>
    </Card>
  );
};

