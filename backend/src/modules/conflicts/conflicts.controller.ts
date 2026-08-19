import { Request, Response, NextFunction } from 'express';
import { conflictsService } from './conflicts.service.js';
import { resolveConflictSchema } from './conflicts.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const listConflicts = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const conflicts = await conflictsService.listConflicts();

    res.status(200).json({
      success: true,
      data: conflicts,
    });
  } catch (err) {
    next(err);
  }
};

export const resolveConflict = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = resolveConflictSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid conflict resolution payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await conflictsService.resolveConflict(
      parseResult.data.conflictId,
      parseResult.data.resolution,
      parseResult.data.notes,
      adminEmail
    );

    res.status(200).json({
      success: true,
      message: 'Conflict resolved and logged to audit trail',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
