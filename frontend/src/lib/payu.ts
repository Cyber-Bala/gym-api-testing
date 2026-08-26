import { api } from './api';

export interface PayUParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  surl: string;
  furl: string;
  hash: string;
  service_provider: string;
}

export interface PayUCheckoutResponse {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  planId: string;
  planName: string;
  payuUrl?: string;
  payuParams?: PayUParams;
  simulated?: boolean;
  keyId?: string;
}

const PAYU_SESSION_KEY = 'payu_checkout_order';

export function markPayUCheckoutStarted(orderId: string) {
  sessionStorage.setItem(PAYU_SESSION_KEY, orderId);
}

export function clearPayUCheckoutSession() {
  sessionStorage.removeItem(PAYU_SESSION_KEY);
}

export function wasPayUCheckoutStarted(): string | null {
  return sessionStorage.getItem(PAYU_SESSION_KEY);
}

export function submitPayUForm(payuUrl: string, params: PayUParams | Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payuUrl;

  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

/**
 * Start PayU checkout for a membership plan.
 * Returns 'submitted' when redirected to PayU, 'simulated' when local verify was used.
 */
export async function startPayUCheckout(planId: string): Promise<'submitted' | 'simulated'> {
  const orderData = await api.post<PayUCheckoutResponse>('/api/v1/payment/create-order', { planId });

  if (orderData.simulated || !orderData.payuUrl || !orderData.payuParams) {
    await api.post('/api/v1/payment/verify', {
      orderId: orderData.orderId,
      paymentId: `pay_sim_${Date.now()}`,
      signature: 'simulated_success',
    });
    clearPayUCheckoutSession();
    return 'simulated';
  }

  markPayUCheckoutStarted(orderData.orderId);
  submitPayUForm(orderData.payuUrl, orderData.payuParams);
  return 'submitted';
}

export function readPaymentQueryResult(): 'success' | 'pending' | 'cancelled' | null {
  const value = new URLSearchParams(window.location.search).get('payment');
  if (value === 'success' || value === 'pending' || value === 'cancelled') {
    return value;
  }
  return null;
}

export function clearPaymentQueryFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('payment')) return;
  url.searchParams.delete('payment');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}
