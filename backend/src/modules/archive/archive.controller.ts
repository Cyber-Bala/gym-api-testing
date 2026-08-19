import { Request, Response, NextFunction } from 'express';
import { archiveService } from './archive.service.js';
import {
  archiveJobSchema,
  studentDepartureSchema,
  reactivateStudentSchema,
} from './archive.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const getLifecycleSummary = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await archiveService.getLifecycleSummary();

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};

export const runArchiveJob = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = archiveJobSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid archive payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const job = await archiveService.runArchiveJob(
      parseResult.data.entityType,
      parseResult.data.cutoffDate,
      adminEmail
    );

    res.status(201).json({
      success: true,
      message: `Cold storage archive job completed for ${job.entityType}`,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

export const processStudentDepartures = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = studentDepartureSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid departure payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await archiveService.processStudentDepartures(
      parseResult.data.studentIds,
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

export const reactivateStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = reactivateStudentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid reactivation payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await archiveService.reactivateStudent(
      parseResult.data.studentId,
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

export const triggerAnonymizationCheck = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await archiveService.runSevenYearAnonymizationCheck();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
