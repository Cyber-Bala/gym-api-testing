import { Request, Response, NextFunction } from 'express';
import { violationsService } from './violations.service.js';
import {
  forgiveViolationSchema,
  manualBanSchema,
  manualUnbanSchema,
} from './violations.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';

export const getStudentViolations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.params.studentId;
    const summary = await violationsService.getStudentViolations(studentId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllFlaggedStudents = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const flagged = await violationsService.getAllFlaggedStudents();

    res.status(200).json({
      success: true,
      data: flagged,
    });
  } catch (err) {
    next(err);
  }
};

export const forgiveViolation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = forgiveViolationSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid forgiveness payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await violationsService.forgiveViolation(
      parseResult.data.violationId,
      parseResult.data.reason,
      adminEmail
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const manualBanStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = manualBanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid ban payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await violationsService.manualBanStudent(
      parseResult.data.studentId,
      parseResult.data.banDurationDays,
      parseResult.data.reason,
      adminEmail
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const manualUnbanStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = manualUnbanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid unban payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await violationsService.manualUnbanStudent(
      parseResult.data.studentId,
      parseResult.data.reason,
      adminEmail,
      parseResult.data.resetStrikes
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const triggerAutoUnban = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await violationsService.runAutoUnbanCheck();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
