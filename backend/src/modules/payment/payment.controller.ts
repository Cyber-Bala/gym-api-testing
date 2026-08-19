import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service.js';
import { createOrderSchema, verifyPaymentSchema } from './payment.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';

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

