import { z } from 'zod';
import type { PayUCheckoutParams } from './payu.js';

export const createOrderSchema = z.object({
  planId: z.string().uuid('Valid planId UUID is required'),
});

/** Dev/simulation verify — also accepts PayU mihpayid as paymentId after redirect sync. */
export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID (txnid) is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Payment signature is required'),
});

export const syncPaymentSchema = z.object({
  orderId: z.string().min(1).optional(),
});

export interface PaymentOrderDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  planId: string;
  planName: string;
  /** @deprecated kept for older clients — use payuUrl */
  keyId?: string;
  payuUrl?: string;
  payuParams?: PayUCheckoutParams;
  /** True when PayU credentials are not configured (local/dev simulate path). */
  simulated?: boolean;
}

export type PayUNotifySource = 'browser_success' | 'browser_failure' | 'webhook_s2s';

export type PayUNotifyResult =
  | 'success_confirmed'
  | 'already_confirmed'
  | 'invalid_hash'
  | 'missing_txnid'
  | 'transaction_not_found'
  | 'amount_mismatch'
  | 'payment_failed'
  | 'pending_status'
  | 'unknown_status';

export interface PayUNotifyOutcome {
  result: PayUNotifyResult;
  orderId?: string;
  paymentId?: string;
  studentId?: string;
  details?: Record<string, unknown>;
}
