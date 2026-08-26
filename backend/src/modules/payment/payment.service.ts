import { eq, and, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { paymentOrders, membershipPlans, students, people } from '../../db/schema/index.js';
import { membershipService } from '../membership/membership.service.js';
import { config } from '../../config/index.js';
import {
  PayUNotifyOutcome,
  PayUNotifySource,
  PaymentOrderDto,
} from './payment.types.js';
import {
  buildPayUParams,
  formatPayUAmount,
  generateTxnId,
  isPayUConfigured,
  normalizePayUStatus,
  verifyPayUResponseHash,
} from './payu.js';

export class PaymentService {
  /**
   * Resolve student record ID from students.id or people.id (personId).
   */
  private async resolveStudentId(studentOrPersonId: string): Promise<string> {
    const [stu] = await db
      .select({ id: students.id })
      .from(students)
      .where(or(eq(students.id, studentOrPersonId), eq(students.personId, studentOrPersonId)))
      .limit(1);

    if (!stu) {
      throw new NotFoundError(`Student record not found for '${studentOrPersonId}'`);
    }

    return stu.id;
  }

  private async loadStudentPayee(studentId: string) {
    const [row] = await db
      .select({
        studentId: students.id,
        rollNumber: students.rollNumber,
        name: people.name,
        email: people.email,
        phone: people.phone,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(eq(students.id, studentId))
      .limit(1);

    if (!row) {
      throw new NotFoundError(`Student payee profile not found for '${studentId}'`);
    }

    return row;
  }

  /**
   * Create PayU checkout (FR-PAY-001).
   * Returns form params for client-side POST to PayU, or a simulated order when keys are missing.
   */
  public async createOrder(studentOrPersonId: string, planId: string): Promise<PaymentOrderDto> {
    const studentId = await this.resolveStudentId(studentOrPersonId);

    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
    if (!plan) {
      throw new NotFoundError(`Membership plan '${planId}' not found`);
    }

    const amountNum = parseFloat(plan.price);
    if (!(amountNum > 0)) {
      throw new ValidationError('Cannot initiate payment for zero or negative plan price');
    }

    const payee = await this.loadStudentPayee(studentId);
    const configured = isPayUConfigured();
    const txnid = configured
      ? generateTxnId(payee.rollNumber || studentId)
      : `order_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    const [order] = await db
      .insert(paymentOrders)
      .values({
        studentId,
        planId,
        orderId: txnid,
        amount: plan.price,
        currency: 'INR',
        status: 'created',
      })
      .returning();

    logger.info({ orderId: txnid, studentId, amount: plan.price, configured }, 'Payment order created');

    if (!configured) {
      return {
        id: order.id,
        orderId: order.orderId,
        amount: amountNum,
        currency: order.currency,
        status: order.status,
        planId: plan.id,
        planName: plan.name,
        simulated: true,
      };
    }

    const payuParams = buildPayUParams({
      txnid,
      amount: amountNum,
      productinfo: `Gym Pass - ${plan.name}`,
      firstname: payee.name,
      email: payee.email,
      phone: payee.phone,
      udf1: order.id,
      udf2: studentId,
    });

    await db
      .update(paymentOrders)
      .set({
        gatewayResponse: { hash_sent: payuParams.hash, payu_params: payuParams },
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));

    return {
      id: order.id,
      orderId: order.orderId,
      amount: amountNum,
      currency: order.currency,
      status: order.status,
      planId: plan.id,
      planName: plan.name,
      keyId: payuParams.key,
      payuUrl: config.PAYU_BASE_URL,
      payuParams,
      simulated: false,
    };
  }

  /**
   * Dev/test verification path (and post-redirect client sync with simulated_success when unconfigured).
   */
  public async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
    studentOrPersonId: string
  ) {
    const studentId = await this.resolveStudentId(studentOrPersonId);

    const [order] = await db
      .select()
      .from(paymentOrders)
      .where(and(eq(paymentOrders.orderId, orderId), eq(paymentOrders.studentId, studentId)))
      .limit(1);

    if (!order) {
      throw new NotFoundError(`Payment order '${orderId}' not found for student`);
    }

    if (order.status === 'paid') {
      const membership = await membershipService.activateMembership(
        studentId,
        order.planId,
        order.paymentId || paymentId
      );
      return {
        success: true,
        message: 'Payment already confirmed and gym membership pass is active.',
        orderId,
        paymentId: order.paymentId || paymentId,
        membership,
      };
    }

    const allowSimulated =
      signature === 'simulated_success' ||
      process.env.NODE_ENV === 'test' ||
      !isPayUConfigured();

    if (!allowSimulated) {
      throw new ValidationError(
        'Direct verify is only available in simulation mode. Complete payment on PayU; status is confirmed via callback/webhook.'
      );
    }

    await db
      .update(paymentOrders)
      .set({
        status: 'paid',
        paymentId,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));

    const membership = await membershipService.activateMembership(studentId, order.planId, paymentId);

    logger.info({ orderId, paymentId, studentId }, 'Simulated payment verified and membership activated');

    return {
      success: true,
      message: 'Payment verified and gym membership pass activated!',
      orderId,
      paymentId,
      membership,
    };
  }

  /**
   * Idempotent PayU notification handler (browser surl/furl + S2S webhook).
   */
  public async processPayUNotification(
    params: Record<string, string>,
    source: PayUNotifySource
  ): Promise<PayUNotifyOutcome> {
    const txnid = (params.txnid || '').trim();
    const rawStatus = (params.status || '').trim();
    const payuStatus = normalizePayUStatus(rawStatus);
    const mihpayid = (params.mihpayid || '').trim();

    logger.info({ source, txnid, rawStatus, payuStatus }, 'PayU notify received');

    if (!txnid) {
      return { result: 'missing_txnid' };
    }

    const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderId, txnid)).limit(1);

    if (!order) {
      logger.error({ txnid, source }, 'PayU notify unknown txnid');
      return { result: 'transaction_not_found', orderId: txnid };
    }

    const hashOk = verifyPayUResponseHash(params);
    const previousGateway =
      order.gatewayResponse && typeof order.gatewayResponse === 'object'
        ? (order.gatewayResponse as Record<string, unknown>)
        : {};

    const notifications = Array.isArray(previousGateway.notifications)
      ? [...(previousGateway.notifications as unknown[])]
      : [];
    notifications.push({
      at: new Date().toISOString(),
      source,
      rawStatus,
      payuStatus,
      hashOk,
      mihpayid,
    });

    await db
      .update(paymentOrders)
      .set({
        gatewayResponse: {
          ...previousGateway,
          last_payu_params: params,
          notifications: notifications.slice(-25),
        },
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));

    if (!hashOk) {
      logger.warn({ txnid, source }, 'PayU notify invalid hash — keeping pending');
      return {
        result: 'invalid_hash',
        orderId: txnid,
        studentId: order.studentId,
      };
    }

    if (order.status === 'paid') {
      return {
        result: 'already_confirmed',
        orderId: txnid,
        paymentId: order.paymentId || mihpayid,
        studentId: order.studentId,
      };
    }

    if (payuStatus === 'success') {
      const expected = formatPayUAmount(order.amount);
      const received = formatPayUAmount(params.amount || order.amount);
      if (expected !== received) {
        logger.error({ txnid, expected, received }, 'PayU amount mismatch');
        return {
          result: 'amount_mismatch',
          orderId: txnid,
          studentId: order.studentId,
          details: { expected, received },
        };
      }

      await db
        .update(paymentOrders)
        .set({
          status: 'paid',
          paymentId: mihpayid || order.paymentId,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));

      await membershipService.activateMembership(
        order.studentId,
        order.planId,
        mihpayid || order.orderId
      );

      logger.info({ txnid, mihpayid, studentId: order.studentId, source }, 'PayU success — membership activated');

      return {
        result: 'success_confirmed',
        orderId: txnid,
        paymentId: mihpayid,
        studentId: order.studentId,
      };
    }

    if (payuStatus === 'failure') {
      await db
        .update(paymentOrders)
        .set({
          status: 'failed',
          paymentId: mihpayid || order.paymentId,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));

      logger.info({ txnid, source }, 'PayU failure marked on order');
      return {
        result: 'payment_failed',
        orderId: txnid,
        paymentId: mihpayid,
        studentId: order.studentId,
      };
    }

    if (payuStatus === 'pending') {
      return {
        result: 'pending_status',
        orderId: txnid,
        studentId: order.studentId,
      };
    }

    return {
      result: 'unknown_status',
      orderId: txnid,
      studentId: order.studentId,
      details: { rawStatus },
    };
  }

  /**
   * @deprecated Razorpay webhook — retained as no-op redirect to PayU processor if payload looks like PayU.
   */
  public async handleWebhook(payload: Record<string, unknown>) {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload || {})) {
      params[k] = v === undefined || v === null ? '' : String(v);
    }

    if (params.txnid && params.hash) {
      const outcome = await this.processPayUNotification(params, 'webhook_s2s');
      return { received: true, provider: 'payu', ...outcome };
    }

    logger.warn({ keys: Object.keys(payload || {}) }, 'Ignored non-PayU webhook payload');
    return { received: true, provider: 'unknown' };
  }

  /**
   * Payment history for a student.
   */
  public async getPaymentHistory(studentOrPersonId: string) {
    const studentId = await this.resolveStudentId(studentOrPersonId);

    const orders = await db
      .select({
        id: paymentOrders.id,
        orderId: paymentOrders.orderId,
        paymentId: paymentOrders.paymentId,
        amount: paymentOrders.amount,
        currency: paymentOrders.currency,
        status: paymentOrders.status,
        createdAt: paymentOrders.createdAt,
        planName: membershipPlans.name,
        durationDays: membershipPlans.durationDays,
      })
      .from(paymentOrders)
      .leftJoin(membershipPlans, eq(paymentOrders.planId, membershipPlans.id))
      .where(eq(paymentOrders.studentId, studentId))
      .orderBy(desc(paymentOrders.createdAt));

    return orders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      paymentId: o.paymentId,
      amount: parseFloat(o.amount),
      currency: o.currency,
      status: o.status,
      planName: o.planName || 'Gym Pass',
      durationDays: o.durationDays || 30,
      createdAt: o.createdAt.toISOString(),
    }));
  }
}

export const paymentService = new PaymentService();
