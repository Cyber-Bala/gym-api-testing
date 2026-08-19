import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  UserCheck,
  UserX,
  Scan,
  RefreshCw,
  Clock,
  Zap,
  CheckCircle2,
  Play,
  LogOut,
  LogIn,
} from 'lucide-react';

interface LiveGymOccupant {
  sessionId: string;
  personId: string;
  name: string;
  email: string;
  role: string;
  identifier: string;
  entryTimestamp: string;
  minutesInside: number;
}

interface LiveOccupancyStats {
  currentCount: number;
  maxCapacity: number;
  occupancyPercentage: number;
  occupants: LiveGymOccupant[];
}

interface ScanResult {
  accessGranted: boolean;
  eventType: 'entry' | 'exit';
  name?: string;
  role?: string;
  identifier?: string;
  slotTime?: string;
  durationMinutes?: number;
  denialReason?: string;
  message: string;
  timestamp: string;
}

export const LiveOccupancyMonitor: React.FC = () => {
  const [stats, setStats] = useState<LiveOccupancyStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Custom Simulator Form
  const [customIdentifier, setCustomIdentifier] = useState<string>('2024CS001');
  const [identifierType, setIdentifierType] = useState<'roll_number' | 'staff_id' | 'email'>('roll_number');
  const [eventType, setEventType] = useState<'entry' | 'exit'>('entry');

  // No-Show trigger
  const [runningNoShow, setRunningNoShow] = useState<boolean>(false);
  const [noShowMessage, setNoShowMessage] = useState<string | null>(null);

  const fetchLiveOccupancy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/access/live-occupancy', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.data);
      }
    } catch {
      // Background fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveOccupancy();
    const interval = setInterval(fetchLiveOccupancy, 8000); // 8s live polling
    return () => clearInterval(interval);
  }, []);

  const handleSimulateScan = async (overrideParams?: {
    identifierType: string;
    identifierValue: string;
    eventType: 'entry' | 'exit';
  }) => {
    setSimulating(true);
    setScanResult(null);

    const payload = overrideParams
      ? {
          deviceId: 'SIM_TURNSTILE_01',
          eventType: overrideParams.eventType,
          identifierType: overrideParams.identifierType,
          identifierValue: overrideParams.identifierValue,
          verificationMode: 'face',
        }
      : {
          deviceId: 'SIM_TURNSTILE_01',
          eventType,
          identifierType,
          identifierValue: customIdentifier,
          verificationMode: 'face',
        };

    try {
      const res = await fetch('/api/v1/access/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const resData = await res.json();
      if (resData.data) {
        setScanResult(resData.data);
      }
      fetchLiveOccupancy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSimulating(false);
    }
  };

  const handleTriggerNoShows = async () => {
    setRunningNoShow(true);
    setNoShowMessage(null);
    try {
      const res = await fetch('/api/v1/access/admin/process-no-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to trigger evaluation');

      setNoShowMessage(
        `Evaluation finished: ${data.data.violationsIssued} violation strike(s) issued, ${data.data.studentsSuspended} student(s) suspended.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setRunningNoShow(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Occupancy Summary */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Live Gym Occupancy & Attendance
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Real-time Turnstile Biometric Stream (ZKBio CV) • Capacity Threshold: 100
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerNoShows}
              disabled={runningNoShow}
              className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
              title="Evaluate No-Shows for ended slots"
            >
              <Zap className={`w-3.5 h-3.5 ${runningNoShow ? 'animate-spin' : ''}`} />
              <span>Run No-Show Audit</span>
            </button>

            <button
              onClick={fetchLiveOccupancy}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh occupancy"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* No-Show Alert */}
        {noShowMessage && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{noShowMessage}</span>
          </div>
        )}

        {/* Occupancy Progress Gauge */}
        {stats && (
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-rec-purple dark:text-rec-gold" />
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Inside Gym Right Now
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {stats.currentCount}
                </span>
                <span className="text-xs text-gray-500 font-medium"> / {stats.maxCapacity} Capacity</span>
              </div>
            </div>

            <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.occupancyPercentage >= 90
                    ? 'bg-red-500'
                    : stats.occupancyPercentage >= 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(2, stats.occupancyPercentage)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1">
              <span>Real-time face verification</span>
              <span>{stats.maxCapacity - stats.currentCount} remaining slots</span>
            </div>
          </div>
        )}

        {/* Active Occupants Grid */}
        {stats && (
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Current Gym Occupants ({stats.occupants.length})
            </h4>

            {stats.occupants.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400">
                Gym is currently empty. Use the simulator below to simulate face turnstile check-ins!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.occupants.map((occ) => (
                  <div
                    key={occ.sessionId}
                    className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-gray-200 dark:border-gray-700/80 shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rec-purple-50 dark:bg-rec-purple-900/40 text-rec-purple dark:text-rec-gold border border-rec-purple-200 dark:border-rec-purple-800/40">
                          {occ.role}
                        </span>
                        <h5 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                          {occ.name}
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          {occ.email}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          handleSimulateScan({
                            identifierType: 'email',
                            identifierValue: occ.email,
                            eventType: 'exit',
                          })
                        }
                        className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs transition-colors"
                        title="Simulate Exit for this user"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Inside: {occ.minutesInside} min</span>
                      </span>
                      <span className="text-[11px] font-mono">
                        {new Date(occ.entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hardware Biometric Turnstile Simulator */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              ZKBio CV Turnstile Hardware Simulator
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Test real-time biometric face authentication, grace window validation, and exit duration tracking.
            </p>
          </div>
        </div>

        {/* Quick Simulator Preset Buttons */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Quick Persona Scans
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <button
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'roll_number',
                  identifierValue: '2024CS001',
                  eventType: 'entry',
                })
              }
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-rec-purple dark:hover:border-rec-gold bg-gray-50 dark:bg-[#202024] text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-gray-900 dark:text-white">
                <span>Karthik (Hosteller)</span>
                <LogIn className="w-3.5 h-3.5 text-rec-purple dark:text-rec-gold group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">Roll: 2024CS001</p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                Simulate Face Entry
              </span>
            </button>

            <button
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'email',
                  identifierValue: 'trainer@rajalakshmi.edu.in',
                  eventType: 'entry',
                })
              }
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-rec-purple dark:hover:border-rec-gold bg-gray-50 dark:bg-[#202024] text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-gray-900 dark:text-white">
                <span>Vignesh (Trainer)</span>
                <LogIn className="w-3.5 h-3.5 text-rec-purple dark:text-rec-gold group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">Bypass Access</p>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1 block">
                Simulate Face Entry
              </span>
            </button>

            <button
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'staff_id',
                  identifierValue: 'REC-FAC-108',
                  eventType: 'entry',
                })
              }
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-rec-purple dark:hover:border-rec-gold bg-gray-50 dark:bg-[#202024] text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-gray-900 dark:text-white">
                <span>Dr. Ramesh (Faculty)</span>
                <LogIn className="w-3.5 h-3.5 text-rec-purple dark:text-rec-gold group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">Staff ID: REC-FAC-108</p>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 block">
                Simulate Face Entry
              </span>
            </button>

            <button
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'roll_number',
                  identifierValue: 'UNKNOWN_ROLL_99',
                  eventType: 'entry',
                })
              }
              className="p-3 rounded-xl border border-red-200 dark:border-red-900/40 hover:border-red-400 bg-red-50/40 dark:bg-red-950/20 text-left transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-red-900 dark:text-red-300">
                <span>Unregistered User</span>
                <UserX className="w-3.5 h-3.5 text-red-600" />
              </div>
              <p className="text-[11px] text-red-600/70 font-mono mt-0.5">Unknown Face</p>
              <span className="text-[10px] text-red-600 font-semibold mt-1 block">
                Test Denial Flow
              </span>
            </button>
          </div>
        </div>

        {/* Custom Scan Trigger Form */}
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-3">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Custom Hardware Event
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-medium text-gray-600 dark:text-gray-400 block mb-1">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
              >
                <option value="entry">Entry Turnstile (IN)</option>
                <option value="exit">Exit Turnstile (OUT)</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-gray-600 dark:text-gray-400 block mb-1">
                Identifier Type
              </label>
              <select
                value={identifierType}
                onChange={(e) => setIdentifierType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
              >
                <option value="roll_number">Roll Number</option>
                <option value="staff_id">Staff ID</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-gray-600 dark:text-gray-400 block mb-1">
                Identifier Value
              </label>
              <input
                type="text"
                value={customIdentifier}
                onChange={(e) => setCustomIdentifier(e.target.value)}
                placeholder="e.g. 2024CS001"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => handleSimulateScan()}
                disabled={simulating}
                className="w-full py-2 px-4 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rec-purple/20 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{simulating ? 'Processing...' : 'Send Hardware Scan'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Scan Decision Result */}
        {scanResult && (
          <div
            className={`p-5 rounded-2xl border transition-all ${
              scanResult.accessGranted
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {scanResult.accessGranted ? (
                  <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <UserX className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {scanResult.accessGranted ? 'ACCESS GRANTED (Turnstile Unlocked)' : 'ACCESS DENIED (Turnstile Locked)'}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">{scanResult.message}</p>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 uppercase">
                {scanResult.eventType}
              </span>
            </div>

            {scanResult.durationMinutes !== undefined && scanResult.durationMinutes > 0 && (
              <div className="mt-3 pt-2 border-t border-emerald-200 dark:border-emerald-800/40 text-xs font-semibold">
                Completed Workout Duration: {scanResult.durationMinutes} Minutes
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
