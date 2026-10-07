import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { reconcileFromApiApp } from './device-sync.service.js';

const headers = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

const apiBase = () => config.API_APP_URL.replace(/\/+$/, '');

/**
 * GET /device-sync/status — portal ↔ api_app ↔ gym-app health in one view.
 */
export const getDeviceSyncStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const r = await fetch(`${apiBase()}/api/sync/status`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`api_app returned HTTP ${r.status}`);
      res.status(200).json({ success: true, data: await r.json() });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /device-sync/pull — trigger portal → api_app pull, then diff
 * api_app against local Postgres. Body { deleteMissingLocally?: boolean }.
 * Deletes are guarded (refused unless api_app confirms a fresh portal pull).
 */
export const postDeviceSyncPull = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleteMissingLocally = Boolean(req.body?.deleteMissingLocally);
    let pull: unknown = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      try {
        const r = await fetch(`${apiBase()}/api/sync/pull`, {
          method: 'POST',
          headers,
          signal: ctrl.signal,
        });
        pull = r.ok ? await r.json() : { error: `api_app pull HTTP ${r.status}` };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      pull = { error: err instanceof Error ? err.message : String(err) };
    }
    const reconcile = await reconcileFromApiApp(deleteMissingLocally);
    res.status(200).json({ success: true, data: { pull, reconcile } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /device-sync/reconcile — dry-run diff only (never deletes).
 */
export const getReconcilePreview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reconcile = await reconcileFromApiApp(false);
    res.status(200).json({ success: true, data: reconcile });
  } catch (err) {
    next(err);
  }
};
