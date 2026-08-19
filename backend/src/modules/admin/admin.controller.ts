import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import { createClosureSchema, createAdminSchema, updateAdminSchema } from './admin.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const getExecutiveAnalytics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const analytics = await adminService.getExecutiveAnalytics();

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

export const getCalendarClosures = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const closures = await adminService.getCalendarClosures();

    res.status(200).json({
      success: true,
      data: closures,
    });
  } catch (err) {
    next(err);
  }
};

export const createCalendarClosure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = createClosureSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid closure payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await adminService.createCalendarClosure(
      parseResult.data.closureDate,
      parseResult.data.reason,
      adminEmail
    );

    res.status(201).json({
      success: true,
      message: `Gym closed for ${result.closureDate}. ${result.cancelledBookingsCount} bookings cancelled.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await adminService.getAuditLogs(limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

export const getRolesHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rolesList = await adminService.getRoles();
    res.status(200).json({
      success: true,
      data: rolesList,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminsList = await adminService.getAdmins();
    res.status(200).json({
      success: true,
      data: adminsList,
    });
  } catch (err) {
    next(err);
  }
};

export const createAdminHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = createAdminSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid admin creation payload', parseResult.error.format());
    }

    const actorEmail = req.user?.email || 'iiic@rajalakshmi.edu.in';
    const newAdmin = await adminService.createAdmin(parseResult.data, actorEmail);

    res.status(201).json({
      success: true,
      message: `Administrator '${newAdmin.email}' created successfully with role '${newAdmin.roleName}'`,
      data: newAdmin,
    });
  } catch (err) {
    next(err);
  }
};

export const updateAdminHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updateAdminSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid admin update payload', parseResult.error.format());
    }

    const actorEmail = req.user?.email || 'iiic@rajalakshmi.edu.in';
    await adminService.updateAdmin(req.params.id, parseResult.data, actorEmail);

    res.status(200).json({
      success: true,
      message: 'Administrator updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const deleteAdminHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const actorEmail = req.user?.email || 'iiic@rajalakshmi.edu.in';
    await adminService.deleteAdmin(req.params.id, actorEmail);

    res.status(200).json({
      success: true,
      message: 'Administrator privileges revoked successfully',
    });
  } catch (err) {
    next(err);
  }
};
