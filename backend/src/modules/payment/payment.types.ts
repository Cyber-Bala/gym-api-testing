import { z } from 'zod';

export const createOrderSchema = z.object({
  planId: z.string().uuid('Valid planId UUID is required'),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Payment signature is required'),
});

export interface PaymentOrderDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  planId: string;
  planName: string;
  keyId?: string;
}
