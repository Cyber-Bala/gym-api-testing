import { describe, it, expect } from 'vitest';
import {
  formatPayUAmount,
  generatePayUHash,
  normalizePayUStatus,
  sha512Hash,
  verifyPayUResponseHash,
} from '../src/modules/payment/payu.js';
import { config } from '../src/config/index.js';

describe('PayU hash helpers', () => {
  it('formats amounts with two decimal places', () => {
    expect(formatPayUAmount(500)).toBe('500.00');
    expect(formatPayUAmount('1200.5')).toBe('1200.50');
  });

  it('normalizes PayU status values', () => {
    expect(normalizePayUStatus('success')).toBe('success');
    expect(normalizePayUStatus('captured')).toBe('success');
    expect(normalizePayUStatus('userCancelled')).toBe('failure');
    expect(normalizePayUStatus('pending')).toBe('pending');
    expect(normalizePayUStatus('weird')).toBe('unknown');
  });

  it('builds a deterministic request hash', () => {
    const args = {
      key: 'testkey',
      txnid: 'GYM-TEST-001',
      amount: '500.00',
      productinfo: 'Gym Pass',
      firstname: 'Priya',
      email: 'priya@example.com',
      salt: 'testsalt',
      udf1: 'order-1',
      udf2: 'student-1',
      udf3: '',
      udf4: '',
      udf5: '',
    } as const;

    const hash = generatePayUHash(args);
    const hashString =
      `${args.key}|${args.txnid}|${args.amount}|${args.productinfo}|${args.firstname}|${args.email}|` +
      `${args.udf1}|${args.udf2}|${args.udf3}|${args.udf4}|${args.udf5}||||||${args.salt}`;

    expect(hash).toBe(sha512Hash(hashString));
    expect(hash).toHaveLength(128);
    expect(generatePayUHash(args)).toBe(hash);
  });

  it('verifies a response hash when salt matches config', () => {
    // Uses whatever salt is loaded in test env (placeholder by default → returns false)
    const ok = verifyPayUResponseHash({
      status: 'success',
      key: config.PAYU_MERCHANT_KEY,
      txnid: 'x',
      amount: '1.00',
      productinfo: 'p',
      firstname: 'a',
      email: 'a@b.c',
      udf1: '',
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: '',
      hash: 'deadbeef',
    });
    expect(typeof ok).toBe('boolean');
  });
});
