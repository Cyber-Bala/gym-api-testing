import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service.js';
import { createOrderSchema, verifyPaymentSchema } from './payment.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';
import {
  extractPayUPostParams,
  frontendPaymentRedirectUrl,
} from './payu.js';
import { logger } from '../../shared/logging/index.js';

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.studentDetails) {
      throw new UnauthorizedError('Student authentication required');
    }

    const parseResult = createOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid order request', parseResult.error.format());
    }

    const order = await paymentService.createOrder(req.user.personId, parseResult.data.planId);

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.studentDetails) {
      throw new UnauthorizedError('Student authentication required');
    }

    const parseResult = verifyPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid payment verification request', parseResult.error.format());
    }

    const result = await paymentService.verifyPayment(
      parseResult.data.orderId,
      parseResult.data.paymentId,
      parseResult.data.signature,
      req.user.personId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyPaymentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.studentDetails) {
      throw new UnauthorizedError('Student authentication required');
    }

    const history = await paymentService.getPaymentHistory(req.user.personId);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
};

function redirectForNotifyResult(res: Response, result: string) {
  if (
    result === 'success_confirmed' ||
    result === 'already_confirmed'
  ) {
    return res.redirect(frontendPaymentRedirectUrl('success'));
  }
  if (result === 'payment_failed') {
    return res.redirect(frontendPaymentRedirectUrl('cancelled'));
  }
  return res.redirect(frontendPaymentRedirectUrl('pending'));
}

function collectPayUParams(req: Request): Record<string, string> {
  return {
    ...extractPayUPostParams(req.query as Record<string, unknown>),
    ...extractPayUPostParams(req.body as Record<string, unknown>),
  };
}

export const payuSuccessCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const params = collectPayUParams(req);
    const outcome = await paymentService.processPayUNotification(params, 'browser_success');
    logger.info({ outcome }, 'PayU browser success callback');
    redirectForNotifyResult(res, outcome.result);
  } catch (err) {
    next(err);
  }
};

export const payuFailureCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const params = collectPayUParams(req);
    const outcome = await paymentService.processPayUNotification(params, 'browser_failure');
    logger.info({ outcome }, 'PayU browser failure callback');
    redirectForNotifyResult(res, outcome.result);
  } catch (err) {
    next(err);
  }
};

export const payuWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const params = collectPayUParams(req);
    const outcome = await paymentService.processPayUNotification(params, 'webhook_s2s');
    logger.info({ outcome }, 'PayU S2S webhook handled');

    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        result: outcome.result,
        orderId: outcome.orderId,
        paymentId: outcome.paymentId,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Legacy alias — accepts PayU form posts as well. */
export const handleWebhook = payuWebhook;
