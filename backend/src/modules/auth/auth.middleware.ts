import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index.js';
import { SessionUser, UserRole } from './auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

export const SESSION_COOKIE_NAME = 'gym_session';

/**
 * Authentication Middleware: Validates session cookie or Authorization header
 */
export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Check HttpOnly cookie first, then fallback to Bearer token
    let sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        sessionId = parts[1];
      }
    }

    if (!sessionId) {
      throw new UnauthorizedError('Authentication required. Please sign in.');
    }

    const sessionData = await authService.getSession(sessionId);
    if (!sessionData) {
      throw new UnauthorizedError('Session has expired or is invalid. Please sign in again.');
    }

    req.user = sessionData.user;
    req.sessionId = sessionData.id;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional Authentication: Attaches session user if cookie or token is present, but doesn't throw if absent
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        sessionId = parts[1];
      }
    }

    if (sessionId) {
      const sessionData = await authService.getSession(sessionId);
      if (sessionData) {
        req.user = sessionData.user;
        req.sessionId = sessionData.id;
      }
    }
  } catch {
    // Silent fail for optional auth
  }
  next();
};

/**
 * Role-Based Access Control Guard
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Super Admin has access to all role-protected endpoints
    if (req.user.role === 'super_admin' || req.user.isProtectedSuperAdmin) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden. Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
};

/**
 * Granular Capability / Permission Guard (Discord-style RBAC)
 */
export const requirePermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Super Admin has global wildcard permission
    if (
      req.user.role === 'super_admin' ||
      req.user.isProtectedSuperAdmin ||
      req.user.permissions.includes('*')
    ) {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return next(
        new ForbiddenError(`Missing required capability permission: '${permission}'`)
      );
    }

    next();
  };
};
