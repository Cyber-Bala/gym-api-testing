import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { Card, Badge, Alert } from '../ui/primitives';
import { Button } from '../ui/Button';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

interface BridgeHealth {
  ok: boolean;
  syncEnabled: boolean;
  gymApi: { up: boolean | null; message: string };
  zkbio: { up: boolean | null; message: string; lastPullAt: string | null };
  faceService: { up: boolean; message: string; registered?: number };
  issues: string[];
}

interface Reconcile {
  apiReachable: boolean;
  apiStudents: number;
  missingInApi: string[]; // in this app, gone from the Gym API / ZKBio
  missingLocally: string[]; // in the Gym API / ZKBio, not in this app
  deletedLocally: string[];
  dryRun: boolean;
}

const Dot: React.FC<{ up: boolean | null; label: string }> = ({ up, label }) => (
  <Badge tone={up === null ? 'neutral' : up ? 'success' : 'danger'}>
    {up === null ? <MinusCircle className="h-3 w-3" /> : up ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
    {label}
  </Badge>
);

/**
 * Shows whether the connected apps (Gym API, ZKBio, face service) are turned on,
 * tells the admin what to turn on, and lets them compare / sync deletions.
 */
export const SyncStatusBanner: React.FC = () => {
  const toast = useToast();
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [diff, setDiff] = useState<Reconcile | null>(null);
  const [keepMissing, setKeepMissing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await api.get<BridgeHealth>('/api/v1/device-sync/health'));
    } catch {
      setHealth({
        ok: false,
        syncEnabled: true,
        gymApi: { up: false, message: '' },
        zkbio: { up: null, message: '', lastPullAt: null },
        faceService: { up: false, message: '' },
        issues: ['The gym backend is not reachable. Turn on the gym backend (npm run dev:backend).'],
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const compare = async () => {
    setChecking(true);
    try {
      setKeepMissing(false);
      setDiff(await api.get<Reconcile>('/api/v1/device-sync/reconcile'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Compare failed', 'Sync check');
    } finally {
      setChecking(false);
    }
  };

  const toggleSync = async () => {
    if (!health) return;
    const turnOn = !health.syncEnabled;
    if (
      !turnOn &&
      !window.confirm(
        'Turn ZKBio sync OFF for testing?\n\nFaces are still saved in the gym app, but nothing is sent to ZKBio until you turn it back on.'
      )
    )
      return;
    setSyncing(true);
    try {
      await api.put('/api/v1/device-sync/settings', { syncEnabled: turnOn });
      toast.success(
        turnOn ? 'ZKBio sync is ON. Waiting students are being added to ZKBio now.' : 'ZKBio sync is OFF (testing).',
        'ZKBio sync'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the setting', 'ZKBio sync');
    } finally {
      setSyncing(false);
      void load();
    }
  };

  const importNow = async () => {
    setSyncing(true);
    try {
      const r = await api.post<{ apiPeople: number; created: number; updated: number; unchanged: number }>(
        '/api/v1/device-sync/import-zkbio'
      );
      toast.success(
        `${r.created} new people added from ZKBio, ${r.updated} updated, ${r.unchanged} already here. ZKBio was not changed.`,
        'Imported from ZKBio'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed', 'Import from ZKBio');
    } finally {
      setSyncing(false);
      void load();
      if (diff) void compare();
    }
  };

  const provisionNow = async () => {
    setSyncing(true);
    try {
      const r = await api.post<{ checked: number; provisioned: number; deprovisioned: number; failed: number }>(
        '/api/v1/device-sync/provision'
      );
      const parts = [`${r.provisioned} added to ZKBio`, `${r.deprovisioned} removed (pass ended)`];
      if (r.failed) toast.error(`${parts.join(', ')}, ${r.failed} failed. Check that ZKBio is on.`, 'ZKBio sync');
      else toast.success(parts.join(', ') + '.', 'ZKBio sync');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed', 'ZKBio sync');
    } finally {
      setSyncing(false);
      void load();
    }
  };

  const applyDeletions = async () => {
    if (!diff?.missingInApi.length) return;
    const list = diff.missingInApi.join(', ');
    if (
      !window.confirm(
        `These students are no longer in the Gym API / ZKBio:\n\n${list}\n\nDelete them from this app (and their face data) too? This cannot be undone.`
      )
    )
      return;
    setSyncing(true);
    try {
      const r = await api.post<{ reconcile: Reconcile }>('/api/v1/device-sync/pull', { deleteMissingLocally: true });
      const gone = r.reconcile.deletedLocally.length;
      if (gone > 0) toast.success(`${gone} student(s) removed to match ZKBio.`, 'Synced');
      else toast.error('Nothing was deleted. The Gym API has not confirmed a fresh ZKBio pull. Turn on ZKBio and try again.', 'Not synced');
      setDiff(r.reconcile);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed', 'Sync');
    } finally {
      setSyncing(false);
      void load();
    }
  };

  if (!health) return null;

  return (
    <Card className="space-y-3 !p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text">Connected apps</span>
        <Dot up={true} label="Gym app" />
        {health.syncEnabled ? (
          <>
            <Dot up={health.gymApi.up} label="Gym API" />
            <Dot up={health.zkbio.up} label="ZKBio" />
          </>
        ) : (
          <Badge tone="warning">ZKBio sync off (testing)</Badge>
        )}
        <Dot up={health.faceService.up} label="Face service" />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant={health.syncEnabled ? 'outline' : 'primary'}
            size="sm"
            onClick={toggleSync}
            loading={syncing}
            disabled={syncing}
          >
            {health.syncEnabled ? 'Turn sync OFF (testing)' : 'Turn sync ON'}
          </Button>
          {health.syncEnabled && (
            <>
          <Button variant="outline" size="sm" onClick={importNow} disabled={syncing || !health.gymApi.up}>
            Import from ZKBio
          </Button>
          <Button variant="outline" size="sm" onClick={provisionNow} loading={syncing} disabled={syncing || !health.gymApi.up}>
            Sync ZKBio now
          </Button>
          <Button variant="outline" size="sm" onClick={compare} disabled={checking || !health.gymApi.up}>
            Compare data
          </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={checking} aria-label="Refresh status">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {health.issues.length > 0 && (
        <Alert tone="danger">
          <ul className="list-disc space-y-1 pl-4">
            {health.issues.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}

      {diff && (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Gym API / ZKBio has <b>{diff.apiStudents}</b> people.
          </p>
          {diff.missingInApi.length === 0 && diff.missingLocally.length === 0 ? (
            <Alert tone="success">Everything matches.</Alert>
          ) : (
            <>
              {diff.missingInApi.length > 0 && !keepMissing && (
                <Alert tone="warning">
                  <p>
                    <b>{diff.missingInApi.length}</b> in this app but not in the Gym API / ZKBio:{' '}
                    <span className="font-mono">{diff.missingInApi.slice(0, 10).join(', ')}</span>
                    {diff.missingInApi.length > 10 && ' …'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => setKeepMissing(true)}>
                      Keep them in this app
                    </Button>
                    <Button size="sm" variant="outline" onClick={applyDeletions} loading={syncing}>
                      Remove these here too
                    </Button>
                  </div>
                </Alert>
              )}
              {diff.missingLocally.length > 0 && (
                <Alert tone="info">
                  <p>
                    <b>{diff.missingLocally.length}</b> in the Gym API / ZKBio but not in this app:{' '}
                    <span className="font-mono">{diff.missingLocally.slice(0, 10).join(', ')}</span>
                  </p>
                  <Button size="sm" variant="primary" className="mt-2" onClick={importNow} loading={syncing}>
                    Add to this app
                  </Button>
                  <p className="mt-1 text-xs text-muted">ZKBio is not changed. The app only copies their details.</p>
                </Alert>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
};
