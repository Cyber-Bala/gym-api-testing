import { Router } from 'express';
import {
  createOrder,
  verifyPayment,
  getMyPaymentHistory,
  payuSuccessCallback,
  payuFailureCallback,
  payuWebhook,
} from './payment.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const paymentRouter = Router();

// Student payment operations
paymentRouter.post('/create-order', requireAuth, createOrder);
paymentRouter.post('/verify', requireAuth, verifyPayment);
paymentRouter.get('/my-history', requireAuth, getMyPaymentHistory);

// PayU browser redirects (surl / furl) — public, CSRF-exempt form POSTs from PayU
paymentRouter.post('/success', payuSuccessCallback);
paymentRouter.get('/success', payuSuccessCallback);
paymentRouter.post('/failure', payuFailureCallback);
paymentRouter.get('/failure', payuFailureCallback);

// PayU server-to-server webhook
paymentRouter.post('/webhook', payuWebhook);
paymentRouter.post('/webhook/payu', payuWebhook);
// Legacy path alias
paymentRouter.post('/webhook/razorpay', payuWebhook);
