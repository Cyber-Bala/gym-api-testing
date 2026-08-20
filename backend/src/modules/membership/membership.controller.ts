import { Request, Response, NextFunction } from 'express';
import { membershipService } from './membership.service.js';
import { UnauthorizedError, ValidationError } from '../../shared/errors/index.js';
import { createPlanSchema, updatePlanSchema } from './membership.types.js';

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

export const getAllPlansForAdmin = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = await membershipService.getAllPlansForAdmin();

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

export const createPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = createPlanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid plan payload', parseResult.error.format());
    }

    const actorEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const plan = await membershipService.createPlan(parseResult.data, actorEmail);

    res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

export const updatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updatePlanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid plan payload', parseResult.error.format());
    }

    const actorEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const plan = await membershipService.updatePlan(req.params.id, parseResult.data, actorEmail);

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

export const togglePlanActive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isActive = Boolean(req.body.isActive);
    const actorEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const plan = await membershipService.setPlanActive(req.params.id, isActive, actorEmail);

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

export const deletePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const planId = req.params.id;
    const actorEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    await membershipService.deletePlan(planId, actorEmail);

    res.status(200).json({
      success: true,
      message: 'Membership package deleted successfully',
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
