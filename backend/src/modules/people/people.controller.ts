import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { peopleService } from './people.service.js';
import { authService } from '../auth/auth.service.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../shared/errors/index.js';
import { studentSelfUpdateSchema, trainerBulkSchema, studentRowSchema } from './people.types.js';

const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'fileName is required'),
  contentType: z.string().optional(),
});

const importRowsSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'At least 1 row is required in payload'),
});

const revokeSchema = z.object({
  reason: z.string().min(3, 'Revocation reason is required'),
});

const trainerRoleSchema = z.object({
  isTrainer: z.boolean(),
});

export const downloadTemplate = (req: Request, res: Response): void => {
  const type = req.params.type;

  if (type === 'students') {
    const buffer = peopleService.generateStudentTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="rec_students_template.xlsx"');
    res.send(buffer);
    return;
  }

  if (type === 'staff') {
    const buffer = peopleService.generateStaffTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="rec_staff_template.xlsx"');
    res.send(buffer);
    return;
  }

  throw new NotFoundError(`Template type '${type}' not found`);
};

export const getUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = uploadUrlSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid upload parameters', parseResult.error.format());
    }

    const result = await peopleService.getPresignedUploadUrl(
      parseResult.data.fileName,
      parseResult.data.contentType
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const importStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = importRowsSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid row data format', parseResult.error.format());
    }

    const report = await peopleService.processStudentRows(parseResult.data.rows);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

export const importStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = importRowsSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid row data format', parseResult.error.format());
    }

    const report = await peopleService.processStaffRows(parseResult.data.rows);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

export const listStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const department = req.query.department as string | undefined;
    const residency = req.query.residency as 'hosteller' | 'day_scholar' | undefined;
    const isBanned = req.query.isBanned !== undefined ? req.query.isBanned === 'true' : undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await peopleService.getStudentsList({
      search,
      department,
      residency,
      isBanned,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const updateMyStudentProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required to update your profile');
    }
    const result = await peopleService.updateMyStudentProfile(req.user.personId, req.body);

    const freshUser = await authService.findAndSyncProvisionedUser(req.user.email);
    if (req.sessionId) {
      await authService.updateSessionUser(req.sessionId, freshUser);
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: {
        ...result,
        user: freshUser,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const setStudentTrainerRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = trainerRoleSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('isTrainer boolean is required', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await peopleService.setStudentTrainerRole(
      req.params.id,
      parseResult.data.isTrainer,
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

export const bulkSetTrainerRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = trainerBulkSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid trainer bulk payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await peopleService.bulkSetTrainerRoles(
      parseResult.data.rollNumbers,
      parseResult.data.action,
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

export const listAuthorizedPersons = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await peopleService.getAuthorizedPersonsList();
    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err) {
    next(err);
  }
};

export const createAuthorizedPerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await peopleService.createAuthorizedPerson(req.body, adminEmail);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const revokeAuthorizedPerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = revokeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Reason is required for revocation', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await peopleService.revokeAuthorizedPerson(
      req.params.id,
      parseResult.data.reason,
      adminEmail
    );

    res.status(200).json({
      success: true,
      message: 'Authorized person access revoked',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const createStudent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = studentRowSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid student data', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await peopleService.createSingleStudent(parseResult.data, adminEmail);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
