import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { SESSION_COOKIE_NAME } from './auth.middleware.js';

const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

const devLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const googleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = googleLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request body', parseResult.error.format());
    }

    const { idToken } = parseResult.data;
    const googlePayload = await authService.verifyGoogleIdToken(idToken);
    const user = await authService.findAndSyncProvisionedUser(googlePayload.email, googlePayload.sub);

    const session = await authService.createSession(user, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    // Set secure cookie
    const isProduction = config.NODE_ENV === 'production';
    const ttlSeconds = authService.getRoleSessionTtlSeconds(user.role);

    res.cookie(SESSION_COOKIE_NAME, session.sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: ttlSeconds * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        user: session.user,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const devLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (config.NODE_ENV === 'production' && !config.ALLOW_DEV_LOGIN) {
      throw new UnauthorizedError('Dev login is disabled in production environment');
    }

    const parseResult = devLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request body', parseResult.error.format());
    }

    const { email } = parseResult.data;
    const user = await authService.findAndSyncProvisionedUser(email);

    const session = await authService.createSession(user, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    const ttlSeconds = authService.getRoleSessionTtlSeconds(user.role);

    res.cookie(SESSION_COOKIE_NAME, session.sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: ttlSeconds * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        user: session.user,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Refresh user state from database so changes to profile, emergency contact, phone, etc. are immediately live
    const freshUser = await authService.findAndSyncProvisionedUser(req.user.email);
    if (req.sessionId) {
      await authService.updateSessionUser(req.sessionId, freshUser);
    }

    res.status(200).json({
      success: true,
      data: {
        user: freshUser,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || req.sessionId;
    if (sessionId) {
      await authService.destroySession(sessionId);
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await authService.destroyAllUserSessions(req.user.accountId);
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    res.status(200).json({
      success: true,
      message: 'All active sessions have been revoked across all devices',
    });
  } catch (err) {
    next(err);
  }
};
