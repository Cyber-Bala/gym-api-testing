import { Request, Response, NextFunction } from 'express';
import { membershipService } from './membership.service.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

export const getPlans = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = await membershipService.getPlans();

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.studentDetails) {
      throw new UnauthorizedError('Student authentication required');
    }

    const membership = await membershipService.getMyMembership(req.user.personId);

    res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

export const triggerExpiryCheck = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await membershipService.runDailyMembershipExpiryCheck();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
