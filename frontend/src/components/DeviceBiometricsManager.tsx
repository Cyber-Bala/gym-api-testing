import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ScanFace,
  RefreshCw,
  Zap,
  CheckCircle2,
  RotateCcw,
  Plus,
  Radio,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface AccessDevice {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  firmwareVersion: string;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeatAt: string;
}

interface FaceSyncTask {
  id: string;
  studentId: string;
  personId: string;
  rollNumber: string;
  name: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'admin_action_required';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export const DeviceBiometricsManager: React.FC = () => {
  const toast = useToast();
  const [devices, setDevices] = useState<AccessDevice[]>([]);
  const [syncQueue, setSyncQueue] = useState<FaceSyncTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Enroll Face Modal
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [enrollStudentId, setEnrollStudentId] = useState<string>('');
  const [enrollSubmitting, setEnrollSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [devData, qData] = await Promise.all([
        api.get<AccessDevice[]>('/api/v1/biometrics/devices'),
        api.get<FaceSyncTask[]>('/api/v1/biometrics/sync-queue'),
      ]);

      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(qData)) setSyncQueue(qData);
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcessSync = async () => {
    setProcessing(true);
    try {
      const data = await api.post<{ message?: string }>('/api/v1/biometrics/sync-process', {});
      const msg = data.message || 'Biometric synchronization processed';
      setNotification(msg);
      toast.success(msg);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Sync Processing Failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrySync = async (syncId: string) => {
    try {
      const data = await api.post<{ message?: string }>('/api/v1/biometrics/sync-retry', { syncId });
      const msg = data.message || 'Sync task re-queued for transmission';
      setNotification(msg);
      toast.info(msg);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Retry Failed');
    }
  };

  const handleSimulateEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollSubmitting(true);
    try {
      await api.post('/api/v1/biometrics/face-enroll', {
        studentId: enrollStudentId || '11111111-1111-1111-1111-111111111111',
        faceImageBase64: 'data:image/jpeg;base64,mock_biometric_face_vector',
      });

      const msg = 'Face biometric enrolled & queued for hardware sync.';
      setNotification(msg);
      toast.success(msg);
      setShowEnrollModal(false);
      setEnrollStudentId('');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Enrollment Failed');
    } finally {
      setEnrollSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Turnstile Hardware & Biometric Sync Center
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              ZKBio CV Hardware Health • Async Face Sync State Machine • Biometric Hash Vectors
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowEnrollModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enroll Face Biometric</span>
            </Button>

            <IconButton
              label="Refresh devices"
              size="sm"
              onClick={fetchData}
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

        {/* Turnstile Devices Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {devices.map((d) => (
            <div
              key={d.deviceId}
              className="p-5 rounded-2xl border border-border bg-border-subtle/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-success animate-pulse" />
                  <h4 className="font-bold text-sm text-text">{d.deviceName}</h4>
                </div>
                <Badge tone="success">{d.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted text-[11px]">IP Address</span>
                  <p className="font-mono text-text">{d.ipAddress}</p>
                </div>
                <div>
                  <span className="text-muted text-[11px]">Firmware</span>
                  <p className="font-mono text-text">{d.firmwareVersion}</p>
                </div>
              </div>

              <p className="text-[11px] text-muted">
                Last Heartbeat: {new Date(d.lastHeartbeatAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Asynchronous Face Biometric Sync Queue */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-base text-text">
                Biometric Template Synchronization Queue
              </h3>
              <p className="text-xs text-secondary">
                Background worker pushes enrolled facial vectors to turnstile hardware memory (Lane A & B).
              </p>
            </div>
          </div>

          <Button
            variant="success"
            size="sm"
            onClick={handleProcessSync}
            loading={processing}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sync Pending Templates</span>
          </Button>
        </div>

        {syncQueue.length === 0 ? (
          <EmptyState
            icon={<ScanFace className="w-6 h-6" />}
            title="Biometric Templates Synchronized"
            description="All biometric facial templates are up to date in turnstile memory."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-border-subtle/50 text-muted font-semibold">
                <tr>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Roll Number</th>
                  <th className="p-3">Sync Status</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3">Last Updated</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {syncQueue.map((task) => (
                  <tr key={task.id} className="hover:bg-border-subtle/30 transition-colors">
                    <td className="p-3 font-bold text-text">{task.name}</td>
                    <td className="p-3 font-mono text-muted">{task.rollNumber}</td>
                    <td className="p-3">
                      <Badge
                        tone={
                          task.status === 'synced'
                            ? 'success'
                            : task.status === 'failed'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {task.status}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-secondary">{task.retryCount}</td>
                    <td className="p-3 font-mono text-muted">
                      {new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      {task.status === 'failed' && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleRetrySync(task.id)}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Enroll Face Modal */}
      <Modal
        open={showEnrollModal}
        title="Enroll Student Face Biometric"
        onClose={() => setShowEnrollModal(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowEnrollModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={enrollSubmitting}
              onClick={handleSimulateEnroll}
            >
              Capture & Enroll
            </Button>
          </>
        }
      >
        <form onSubmit={handleSimulateEnroll} className="space-y-4 text-xs">
          <Input
            label="Student UUID or Roll Number"
            placeholder="Enter Student UUID or leave blank for default"
            value={enrollStudentId}
            onChange={(e) => setEnrollStudentId(e.target.value)}
          />

          <div className="p-4 rounded-xl border border-dashed border-border bg-border-subtle/30 text-center space-y-2">
            <ScanFace className="w-8 h-8 text-primary mx-auto" />
            <p className="text-secondary text-xs">
              Simulated biometric camera stream active. High-definition vector extraction ready.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
};

