import React, { useEffect, useState } from 'react';
import { Activity, Database, Server, HardDrive, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface ServiceStatus {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: 'ready' | 'degraded';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    storage: ServiceStatus;
  };
}

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/health/ready');
      if (!res.ok && res.status !== 503) {
        throw new Error(`Health probe responded with HTTP ${res.status}`);
      }
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white dark:bg-[#18181B] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rec-purple-50 dark:bg-rec-purple-900/40 text-rec-purple dark:text-rec-purple-300 border border-rec-purple-200 dark:border-rec-purple-800/50">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Platform Service Health</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Real-time status of underlying infrastructure dependencies</p>
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-gray-700 dark:text-gray-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-sm mb-4 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Unable to reach backend API</p>
            <p className="text-xs mt-0.5 opacity-90">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PostgreSQL */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
              <Database className="w-4 h-4 text-blue-500" />
              <span>PostgreSQL 16</span>
            </div>
            {health?.services.database.status === 'up' ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3" /> UP
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                <AlertCircle className="w-3 h-3" /> OFFLINE
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">System of record (Authoritative DB)</p>
          {health?.services.database.latencyMs !== undefined && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Latency: {health.services.database.latencyMs}ms</p>
          )}
        </div>

        {/* Redis */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
              <Server className="w-4 h-4 text-red-500" />
              <span>Redis 7</span>
            </div>
            {health?.services.redis.status === 'up' ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3" /> UP
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                <AlertCircle className="w-3 h-3" /> OFFLINE
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sessions, BullMQ queues & rate limits</p>
          {health?.services.redis.latencyMs !== undefined && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Latency: {health.services.redis.latencyMs}ms</p>
          )}
        </div>

        {/* MinIO */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
              <HardDrive className="w-4 h-4 text-amber-500" />
              <span>MinIO Storage</span>
            </div>
            {health?.services.storage.status === 'up' ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3" /> UP
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                <AlertCircle className="w-3 h-3" /> OFFLINE
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Imports, reports & Parquet archives</p>
          {health?.services.storage.latencyMs !== undefined && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Latency: {health.services.storage.latencyMs}ms</p>
          )}
        </div>
      </div>
    </div>
  );
};
