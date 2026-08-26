import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

export interface PayUCheckoutParams {
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

export function formatPayUAmount(amount: number | string): string {
  return Number(amount).toFixed(2);
}

export function sha512Hash(value: string): string {
  return crypto.createHash('sha512').update(value).digest('hex').toLowerCase();
}

export function getPayUSalt(): string {
  const verification = config.PAYU_VERIFICATION_SALT?.trim() || '';
  const merchant = config.PAYU_MERCHANT_SALT?.trim() || '';
  return verification || merchant;
}

export function isPayUConfigured(): boolean {
  const key = config.PAYU_MERCHANT_KEY?.trim() || '';
  const salt = getPayUSalt();
  if (!key || !salt) return false;
  if (key.includes('placeholder') || salt.includes('placeholder')) return false;
  return true;
}

export function generateTxnId(studentShort: string): string {
  const safe = (studentShort || 'stu').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'stu';
  return `GYM-${safe}-${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * PayU request hash:
 * key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
 */
export function generatePayUHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  salt: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): string {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    salt,
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = '',
  } = params;

  const hashString =
    `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|` +
    `${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;

  return sha512Hash(hashString);
}

/**
 * PayU response hash (reverse order). Supports additionalCharges when present.
 */
export function verifyPayUResponseHash(params: Record<string, string>): boolean {
  const salt = getPayUSalt();
  if (!salt) return false;

  const status = params.status || '';
  const key = params.key || '';
  const txnid = params.txnid || '';
  const amount = params.amount || '';
  const productinfo = params.productinfo || '';
  const firstname = params.firstname || '';
  const email = params.email || '';
  const udf1 = params.udf1 || '';
  const udf2 = params.udf2 || '';
  const udf3 = params.udf3 || '';
  const udf4 = params.udf4 || '';
  const udf5 = params.udf5 || '';
  const additionalCharges = params.additionalCharges || params.additional_charges || '';

  const reverseFields =
    `${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|` +
    `${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;

  const hashString = additionalCharges
    ? `${additionalCharges}|${salt}|${status}||||||${reverseFields}`
    : `${salt}|${status}||||||${reverseFields}`;

  const calculated = sha512Hash(hashString);
  const received = (params.hash || '').toLowerCase();
  return Boolean(received) && calculated === received;
}

export function normalizePayUStatus(rawStatus: string): 'success' | 'failure' | 'pending' | 'unknown' {
  const status = (rawStatus || '').trim().toLowerCase();
  if (['success', 'captured'].includes(status)) return 'success';
  if (['not found', 'notfound'].includes(status)) return 'pending';
  if (
    ['failure', 'failed', 'bounced', 'dropped', 'usercancelled', 'cancelled', 'autorefund'].includes(
      status
    )
  ) {
    return 'failure';
  }
  if (['pending', 'in progress', 'in_progress', 'initiated'].includes(status)) return 'pending';
  return 'unknown';
}

export function buildPayUParams(input: {
  txnid: string;
  amount: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone?: string | null;
  udf1?: string;
  udf2?: string;
}): PayUCheckoutParams {
  const amount = Number(input.amount);
  if (!(amount > 0)) {
    throw new Error('Cannot initiate PayU payment for zero or negative amount');
  }

  const key = config.PAYU_MERCHANT_KEY.trim();
  const salt = getPayUSalt();
  if (!key || !salt) {
    throw new Error('PayU merchant key or salt is not configured');
  }

  const amountStr = formatPayUAmount(amount);
  const firstname = (input.firstname || 'Student').trim().slice(0, 60);
  const email = input.email.trim();
  const phone = (input.phone || '9999999999').trim().slice(0, 20);
  const udf1 = input.udf1 || '';
  const udf2 = input.udf2 || '';
  const udf3 = '';
  const udf4 = '';
  const udf5 = '';

  const hash = generatePayUHash({
    key,
    txnid: input.txnid,
    amount: amountStr,
    productinfo: input.productinfo,
    firstname,
    email,
    salt,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
  });

  const backendBase = config.PAYU_BACKEND_URL.replace(/\/$/, '');
  const apiPrefix = config.API_PREFIX.replace(/\/$/, '');

  return {
    key,
    txnid: input.txnid,
    amount: amountStr,
    productinfo: input.productinfo,
    firstname,
    email,
    phone,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    surl: `${backendBase}${apiPrefix}/payment/success`,
    furl: `${backendBase}${apiPrefix}/payment/failure`,
    hash,
    service_provider: 'payu_paisa',
  };
}

export function extractPayUPostParams(body: Record<string, unknown> | undefined): Record<string, string> {
  if (!body || typeof body !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) {
      result[key] = '';
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

export function frontendPaymentRedirectUrl(
  result: 'success' | 'pending' | 'cancelled',
  extra?: Record<string, string>
): string {
  const base = config.FRONTEND_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ payment: result, ...extra });
  return `${base}/?${params.toString()}`;
}
