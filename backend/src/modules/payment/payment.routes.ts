import { Router } from 'express';
import { createOrder, verifyPayment } from './payment.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const paymentRouter = Router();

paymentRouter.post('/create-order', requireAuth, createOrder);
paymentRouter.post('/verify', requireAuth, verifyPayment);
