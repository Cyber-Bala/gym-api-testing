import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ScanFace,
  RefreshCw,
  Zap,
  CheckCircle2,
  RotateCcw,
  Plus,
  X,
  Radio,
} from 'lucide-react';

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
      const [devRes, qRes] = await Promise.all([
        fetch('/api/v1/biometrics/devices', { credentials: 'include' }),
        fetch('/api/v1/biometrics/sync-queue', { credentials: 'include' }),
      ]);

      const [devData, qData] = await Promise.all([devRes.json(), qRes.json()]);

      if (devRes.ok && devData.success) setDevices(devData.data || []);
      if (qRes.ok && qData.success) setSyncQueue(qData.data || []);
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
      const res = await fetch('/api/v1/biometrics/sync-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(data.message || 'Biometric synchronization processed');
        fetchData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrySync = async (syncId: string) => {
    try {
      const res = await fetch('/api/v1/biometrics/sync-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(data.message || 'Sync task re-queued for transmission');
        fetchData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSimulateEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollSubmitting(true);
    try {
      const res = await fetch('/api/v1/biometrics/face-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: enrollStudentId || '11111111-1111-1111-1111-111111111111',
          faceImageBase64: 'data:image/jpeg;base64,mock_biometric_face_vector',
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Face enrollment failed');

      setNotification('Face biometric enrolled & queued for hardware sync.');
      setShowEnrollModal(false);
      setEnrollStudentId('');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setEnrollSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Turnstile Hardware & Biometric Sync Center
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              ZKBio CV Hardware Health • Async Face Sync State Machine (ADR-011) • Restricted Storage
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEnrollModal(true)}
              className="px-3 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rec-purple/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enroll Face Biometric</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh devices"
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

        {/* Turnstile Devices Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((d) => (
            <div
              key={d.deviceId}
              className="p-5 rounded-2xl bg-gray-50/50 dark:bg-[#202024]/50 border border-gray-200 dark:border-gray-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{d.deviceName}</h4>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300">
                  {d.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 text-[11px]">IP Address</span>
                  <p className="font-mono text-gray-800 dark:text-gray-200">{d.ipAddress}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px]">Firmware</span>
                  <p className="font-mono text-gray-800 dark:text-gray-200">{d.firmwareVersion}</p>
                </div>
              </div>

              <p className="text-[11px] text-gray-400">
                Last Heartbeat: {new Date(d.lastHeartbeatAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Asynchronous Face Biometric Sync Queue */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Biometric Template Synchronization Queue
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Background worker pushes enrolled facial vectors to turnstile hardware memory (Lane A & B).
              </p>
            </div>
          </div>

          <button
            onClick={handleProcessSync}
            disabled={processing}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{processing ? 'Transmitting to Hardware...' : 'Sync Pending Templates'}</span>
          </button>
        </div>

        {syncQueue.length === 0 ? (
          <div className="p-8 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
            All biometric facial templates are synchronized with turnstiles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500">
                <tr>
                  <th className="p-3 rounded-l-xl">Student Name</th>
                  <th className="p-3">Roll Number</th>
                  <th className="p-3">Sync Status</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3">Last Updated</th>
                  <th className="p-3 rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {syncQueue.map((task) => (
                  <tr key={task.id}>
                    <td className="p-3 font-bold text-gray-900 dark:text-white">{task.name}</td>
                    <td className="p-3 font-mono text-gray-500">{task.rollNumber}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          task.status === 'synced'
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                            : task.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{task.retryCount}</td>
                    <td className="p-3 font-mono text-gray-400">
                      {new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      {task.status === 'failed' && (
                        <button
                          onClick={() => handleRetrySync(task.id)}
                          className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enroll Face Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-rec-purple" />
                Enroll Student Face Biometric
              </h4>
              <button onClick={() => setShowEnrollModal(false)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSimulateEnroll} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Student UUID or Select Karthik Raja (Hosteller)
                </label>
                <input
                  type="text"
                  placeholder="Enter Student UUID or leave blank for default"
                  value={enrollStudentId}
                  onChange={(e) => setEnrollStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-700 text-center space-y-2">
                <ScanFace className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-gray-500 text-[11px]">
                  Simulated biometric camera stream active. High-definition vector extraction ready.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold disabled:opacity-50"
                >
                  {enrollSubmitting ? 'Extracting Vector...' : 'Capture & Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
