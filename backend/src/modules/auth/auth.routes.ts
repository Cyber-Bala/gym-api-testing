import { Router } from 'express';
import { googleLogin, devLogin, getMe, logout, logoutAll } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

export const authRouter = Router();

// Public auth endpoints
authRouter.post('/google', googleLogin);
authRouter.post('/dev-login', devLogin);

// Protected session endpoints
authRouter.get('/me', requireAuth, getMe);
authRouter.post('/logout', logout);
authRouter.post('/logout-all', requireAuth, logoutAll);
