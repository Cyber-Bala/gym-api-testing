import React, { useEffect, useState } from 'react';
import { Activity, Database, Server, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, Badge, Alert } from '../ui/primitives';
import { IconButton } from '../ui/Button';
import { cn } from '../lib/cn';

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
    <Card className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-muted/20 text-primary border border-primary/30">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-text">Platform Service Health</h3>
            <p className="text-xs text-secondary">Real-time status of underlying infrastructure dependencies</p>
          </div>
        </div>
        <IconButton
          label="Refresh service health"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </IconButton>
      </div>

      {error && (
        <Alert tone="danger" onDismiss={() => setError(null)}>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs">Unable to reach backend API</p>
              <p className="text-[11px] mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PostgreSQL */}
        <div className="p-4 rounded-xl border border-border bg-border-subtle/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text font-semibold text-sm">
              <Database className="w-4 h-4 text-primary" />
              <span>PostgreSQL 16</span>
            </div>
            <Badge tone={health?.services.database.status === 'up' ? 'success' : 'danger'}>
              {health?.services.database.status === 'up' ? 'UP' : 'OFFLINE'}
            </Badge>
          </div>
          <p className="text-xs text-secondary">System of record (Authoritative DB)</p>
          {health?.services.database.latencyMs !== undefined && (
            <p className="text-[11px] text-muted font-mono">Latency: {health.services.database.latencyMs}ms</p>
          )}
        </div>

        {/* Redis */}
        <div className="p-4 rounded-xl border border-border bg-border-subtle/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text font-semibold text-sm">
              <Server className="w-4 h-4 text-accent" />
              <span>Redis 7</span>
            </div>
            <Badge tone={health?.services.redis.status === 'up' ? 'success' : 'danger'}>
              {health?.services.redis.status === 'up' ? 'UP' : 'OFFLINE'}
            </Badge>
          </div>
          <p className="text-xs text-secondary">Sessions, BullMQ queues & rate limits</p>
          {health?.services.redis.latencyMs !== undefined && (
            <p className="text-[11px] text-muted font-mono">Latency: {health.services.redis.latencyMs}ms</p>
          )}
        </div>

        {/* MinIO */}
        <div className="p-4 rounded-xl border border-border bg-border-subtle/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text font-semibold text-sm">
              <HardDrive className="w-4 h-4 text-warning" />
              <span>MinIO Storage</span>
            </div>
            <Badge tone={health?.services.storage.status === 'up' ? 'success' : 'danger'}>
              {health?.services.storage.status === 'up' ? 'UP' : 'OFFLINE'}
            </Badge>
          </div>
          <p className="text-xs text-secondary">Imports, reports & Parquet archives</p>
          {health?.services.storage.latencyMs !== undefined && (
            <p className="text-[11px] text-muted font-mono">Latency: {health.services.storage.latencyMs}ms</p>
          )}
        </div>
      </div>
    </Card>
  );
};

