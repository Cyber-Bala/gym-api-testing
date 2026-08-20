import { Router } from 'express';
import { createOrder, verifyPayment, getMyPaymentHistory, handleWebhook } from './payment.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const paymentRouter = Router();

// Student payment operations
paymentRouter.post('/create-order', requireAuth, createOrder);
paymentRouter.post('/verify', requireAuth, verifyPayment);
paymentRouter.get('/my-history', requireAuth, getMyPaymentHistory);

// Razorpay Webhook Callbacks (Public endpoint called directly by Razorpay servers)
paymentRouter.post('/webhook', handleWebhook);
paymentRouter.post('/webhook/razorpay', handleWebhook);
