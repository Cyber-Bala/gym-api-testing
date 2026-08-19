import { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service.js';
import { reportFilterSchema } from './reports.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = reportFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new ValidationError('Invalid report query parameters', parseResult.error.format());
    }

    const report = await reportsService.generateReport(
      parseResult.data.reportType,
      parseResult.data
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

export const exportReportCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = reportFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new ValidationError('Invalid report query parameters', parseResult.error.format());
    }

    const report = await reportsService.generateReport(
      parseResult.data.reportType,
      parseResult.data
    );

    const csvContent = reportsService.exportToCsv(report);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rec_gym_${parseResult.data.reportType}_${Date.now()}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
