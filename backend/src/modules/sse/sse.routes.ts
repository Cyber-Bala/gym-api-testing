import { Router } from 'express';
import { connectSSE } from './sse.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const sseRouter = Router();

// Endpoint: GET /api/v1/sse
sseRouter.get('/', requireAuth, connectSSE);
