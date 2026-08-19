import React, { useState, useEffect } from 'react';
import {
  Archive,
  Database,
  GraduationCap,
  RefreshCw,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, Stat, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

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
  const toast = useToast();
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
      const data = await api.get<LifecycleSummary>('/api/v1/archive/summary');
      if (data) {
        setSummary(data);
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
      const data = await api.post<{ recordCount: number }>('/api/v1/archive/job', {
        entityType,
        cutoffDate,
      });

      const msg = `Cold storage archive created for ${entityType} (${data.recordCount} records).`;
      setNotification(msg);
      toast.success(msg);
      setShowArchiveModal(false);
      fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Archive Job Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const studentIds = departureStudentId ? [departureStudentId] : ['11111111-1111-1111-1111-111111111111'];
      const data = await api.post<{ message?: string }>('/api/v1/archive/departure', {
        studentIds,
        reason: departureReason,
      });

      const msg = data.message || 'Student departures processed and anonymized.';
      setNotification(msg);
      toast.success(msg);
      setShowDepartureModal(false);
      setDepartureStudentId('');
      fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Departure Processing Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Data Lifecycle, Retention & Cold Storage Archive
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Parquet/Zstandard Cold Storage • 7-Year Anonymization • Student Departure & Purge
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDepartureModal(true)}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Process Student Departure</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowArchiveModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Archive Job</span>
            </Button>

            <IconButton
              label="Refresh lifecycle"
              size="sm"
              onClick={fetchSummary}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </IconButton>
          </div>
        </div>

        {notification && (
          <Alert tone="success" onDismiss={() => setNotification(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>{notification}</span>
            </div>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Archived Parquet Jobs"
            value={summary?.totalArchiveJobs || 0}
            hint="Cold storage files"
            icon={<Archive className="w-4 h-4 text-primary" />}
          />
          <Stat
            label="Cold Storage Records"
            value={summary?.coldStorageRecordsCount || 0}
            hint="Compressed row records"
            icon={<Database className="w-4 h-4 text-accent" />}
          />
          <Stat
            label="Departed Students Purged"
            value={summary?.departedStudentsCount || 0}
            hint="Biometric credentials purged"
            icon={<GraduationCap className="w-4 h-4 text-danger" />}
          />
          <Stat
            label="7-Year Anonymized"
            value={summary?.anonymizedProfilesCount || 0}
            hint="GDPR/Retention compliance"
            icon={<Database className="w-4 h-4 text-success" />}
          />
        </div>
      </Card>

      {/* Archive Jobs List */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base text-text">
            Cold Storage Archival Jobs & Compressed Parquet Bundles
          </h3>
        </div>

        {summary && summary.jobs.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-border-subtle/60 text-muted font-semibold">
                <tr>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Cutoff Date</th>
                  <th className="p-3">Record Count</th>
                  <th className="p-3">Storage Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {summary.jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-border-subtle/30 transition-colors">
                    <td className="p-3 font-bold uppercase text-text">{j.entityType}</td>
                    <td className="p-3 font-mono text-secondary">{j.cutoffDate}</td>
                    <td className="p-3 font-mono font-semibold text-success">{j.recordCount} rows</td>
                    <td className="p-3 font-mono text-muted truncate max-w-xs">{j.storagePath}</td>
                    <td className="p-3">
                      <Badge tone={j.status === 'completed' ? 'success' : 'warning'}>
                        {j.status}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-muted">{new Date(j.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Archive className="w-6 h-6" />}
            title="No Cold Archives Created"
            description="No historical cold archive jobs created yet. Run an archive job above to compress old logs into Parquet format."
          />
        )}
      </Card>

      {/* Archive Modal */}
      <Modal
        open={showArchiveModal}
        title="Create Cold Storage Archive (Parquet)"
        onClose={() => setShowArchiveModal(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowArchiveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleCreateArchiveJob}
            >
              Run Archive Job
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateArchiveJob} className="space-y-4 text-xs">
          <Select
            label="Entity Domain"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as any)}
          >
            <option value="access_logs">Turnstile Access & Entry Logs</option>
            <option value="bookings">Historical Slot Bookings</option>
            <option value="violations">Resolved Disciplinary Violations</option>
          </Select>

          <Input
            label="Cutoff Date (YYYY-MM-DD)"
            type="date"
            required
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
          />
        </form>
      </Modal>

      {/* Departure Wizard Modal */}
      <Modal
        open={showDepartureModal}
        title="Student Departure & Access Termination"
        onClose={() => setShowDepartureModal(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowDepartureModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={submitting}
              onClick={handleProcessDeparture}
            >
              Execute Departure
            </Button>
          </>
        }
      >
        <form onSubmit={handleProcessDeparture} className="space-y-4 text-xs">
          <p className="text-secondary">
            Processing departure marks student accounts as departed, revokes turnstile facial biometric templates, expires memberships, and cancels active reservations.
          </p>

          <Input
            label="Departure Reason / Cohort"
            type="text"
            required
            value={departureReason}
            onChange={(e) => setDepartureReason(e.target.value)}
          />

          <Input
            label="Target Student UUID (Leave blank for default batch)"
            type="text"
            placeholder="Enter Student UUID or leave blank"
            value={departureStudentId}
            onChange={(e) => setDepartureStudentId(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
};

