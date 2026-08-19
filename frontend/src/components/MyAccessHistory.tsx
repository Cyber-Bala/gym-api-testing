import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Stat, PageHeader, EmptyState } from '../ui/primitives';
import { IconButton } from '../ui/Button';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import {
  DoorOpen,
  LogIn,
  LogOut,
  Timer,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface AccessSession {
  id: string;
  entryTimestamp: string;
  exitTimestamp: string | null;
  status: string;
  entryDeviceId?: string;
  exitDeviceId?: string;
  durationMinutes: number | null;
}

interface AccessLog {
  id: string;
  eventType: string;
  deviceId: string;
  result: string;
  denialReason?: string | null;
  createdAt: string;
}

interface MyAccessHistoryData {
  sessions: AccessSession[];
  logs: AccessLog[];
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const fmtTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '—';

const fmtDuration = (mins?: number | null) => {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'inside':
      return { label: 'Inside', tone: 'success' as const };
    case 'exited':
      return { label: 'Exited', tone: 'neutral' as const };
    case 'conflict':
      return { label: 'Conflict', tone: 'warning' as const };
    default:
      return { label: status, tone: 'neutral' as const };
  }
};

export const MyAccessHistory: React.FC = () => {
  const [data, setData] = useState<MyAccessHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<MyAccessHistoryData>('/api/v1/access/my-logs');
      setData({ sessions: res.sessions ?? [], logs: res.logs ?? [] });
    } catch {
      setData({ sessions: [], logs: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalVisits = data?.sessions.length ?? 0;
  const totalMinutes = (data?.sessions ?? []).reduce(
    (sum, s) => sum + (s.durationMinutes ?? 0),
    0
  );
  const insideNow = (data?.sessions ?? []).filter((s) => s.status === 'inside').length;
  const deniedCount = (data?.logs ?? []).filter((l) => l.result === 'denied').length;
  const denials = (data?.logs ?? []).filter((l) => l.result === 'denied');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Entry & Exit"
        badge={<Badge tone="primary">Student</Badge>}
        actions={
          <IconButton label="Refresh history" size="sm" onClick={load}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </IconButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Visits" value={totalVisits} icon={<DoorOpen className="w-4 h-4" />} />
        <Stat label="Time Inside" value={fmtDuration(totalMinutes)} icon={<Timer className="w-4 h-4" />} />
        <Stat
          label="Currently Inside"
          value={insideNow > 0 ? 'Yes' : 'No'}
          icon={<LogIn className="w-4 h-4" />}
        />
        <Stat
          label="Denied Attempts"
          value={deniedCount}
          icon={<ShieldAlert className="w-4 h-4" />}
        />
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-text">Entry & Exit History</h3>
          </div>
          <Badge tone="neutral">{totalVisits} sessions</Badge>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-muted">Loading your access history...</div>
        ) : totalVisits === 0 ? (
          <EmptyState
            icon={<DoorOpen className="w-6 h-6" />}
            title="No visits recorded"
          />
        ) : (
          <div className="divide-y divide-border">
            {(data?.sessions ?? []).map((s) => {
              const badge = statusBadge(s.status);
              return (
                <div key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-xl shrink-0',
                        s.status === 'inside'
                          ? 'bg-success-muted text-success border border-success/20'
                          : 'bg-border-subtle text-muted border border-border'
                      )}
                    >
                      {s.status === 'inside' ? (
                        <LogIn className="w-4 h-4" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text">{fmtDate(s.entryTimestamp)}</p>
                      <p className="text-[11px] text-muted font-mono">
                        {fmtTime(s.entryTimestamp)} → {s.exitTimestamp ? fmtTime(s.exitTimestamp) : 'ongoing'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs font-semibold text-text tabular-nums">
                      {fmtDuration(s.durationMinutes)}
                    </span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {denials.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-danger" />
            <h3 className="font-bold text-sm text-text">Denied Attempts</h3>
          </div>
          <div className="divide-y divide-border">
            {denials.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <XCircle className="w-4 h-4 text-danger shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text">
                      {l.denialReason || l.eventType.replace('_', ' ')}
                    </p>
                    <p className="text-[11px] text-muted font-mono">{fmtDate(l.createdAt)}</p>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-muted shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};