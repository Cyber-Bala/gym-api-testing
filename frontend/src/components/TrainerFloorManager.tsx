import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
} from 'lucide-react';
import { Card, Badge, Stat, EmptyState } from '../ui/primitives';
import { IconButton } from '../ui/Button';
import { api } from '../lib/api';
import { cn } from '../lib/cn';

interface LiveFloorOccupant {
  sessionId: string;
  personId: string;
  name: string;
  rollNumber?: string;
  department?: string;
  residency?: string;
  role: string;
  entryTimestamp: string;
  minutesElapsed: number;
  isOverstayer: boolean;
  overdueMinutes: number;
}

interface FloorStatus {
  currentSlotName: string;
  totalInsideCount: number;
  overstayerCount: number;
  occupants: LiveFloorOccupant[];
  overstayers: LiveFloorOccupant[];
}

export const TrainerFloorManager: React.FC = () => {
  const [status, setStatus] = useState<FloorStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const floorData = await api.get<FloorStatus>('/api/v1/floor/status');
      if (floorData) setStatus(floorData);
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Floor Overview Header */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Gym Floor Supervision
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Live floor occupancy • Turnstile check-in synchronization • Overstayer identification
            </p>
          </div>

          <IconButton
            label="Refresh floor status"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>

        {/* Status Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Occupants on Floor"
            value={`${status?.totalInsideCount || 0} / 100`}
            hint="Turnstile biometric session"
            icon={<Users className="w-4 h-4 text-primary" />}
          />
          <Stat
            label="Overstayers Detected"
            value={status?.overstayerCount || 0}
            hint={
              (status?.overstayerCount || 0) > 0 ? (
                <span className="text-danger font-semibold">Exceeded slot cutoff</span>
              ) : (
                'All within booked slots'
              )
            }
            icon={<AlertTriangle className={cn('w-4 h-4', (status?.overstayerCount || 0) > 0 ? 'text-danger' : 'text-muted')} />}
          />
          <Stat
            label="Floor Status"
            value="Active"
            hint="Supervisor live session"
            icon={<Zap className="w-4 h-4 text-success" />}
          />
        </div>

        {/* Overstayers Alert Section */}
        {status && status.overstayers.length > 0 && (
          <div className="p-5 rounded-2xl bg-danger-muted/15 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm">
                Overstayer Alert ({status.overstayers.length} Occupant(s) exceeded slot limit)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {status.overstayers.map((o) => (
                <div
                  key={o.sessionId}
                  className="p-4 rounded-xl bg-surface-elevated flex items-center justify-between shadow-sm"
                >
                  <div className="space-y-0.5 min-w-0">
                    <h5 className="font-bold text-sm text-text truncate">{o.name}</h5>
                    <p className="text-xs text-muted font-mono truncate">
                      {o.rollNumber ? `Roll: ${o.rollNumber} • ` : ''}{o.department || o.role}
                    </p>
                    <p className="text-[11px] text-danger font-semibold">
                      Inside for {o.minutesElapsed} mins ({o.overdueMinutes} mins overdue)
                    </p>
                  </div>

                  <Badge tone="danger">Overdue</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Occupants List */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
            All Current Floor Occupants ({status?.occupants.length || 0})
          </h4>

          {status && status.occupants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {status.occupants.map((occ) => (
                <div
                  key={occ.sessionId}
                  className={cn(
                    'p-4 rounded-2xl space-y-2 transition-all shadow-sm',
                    occ.isOverstayer ? 'bg-danger-muted/15' : 'bg-surface-elevated hover:shadow-md'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-sm text-text">{occ.name}</h5>
                      <span className="text-[10px] uppercase font-bold text-muted">
                        {occ.role} {occ.rollNumber ? `• ${occ.rollNumber}` : ''}
                      </span>
                    </div>

                    <Badge tone={occ.isOverstayer ? 'danger' : 'success'}>
                      {occ.isOverstayer ? 'Overstay' : 'Valid'}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted" />
                    <span>Inside for {occ.minutesElapsed} minutes</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="No occupants on gym floor"
              description="When students and faculty check in at the turnstile, their active floor sessions will display here."
            />
          )}
        </div>
      </Card>
    </div>
  );
};

