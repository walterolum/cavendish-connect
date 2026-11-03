import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { reportsService } from '../services/reports.service';
import { successResponse } from '../utils/response';

export class ReportsController {
  async createReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const report = await reportsService.createReport(req.user!.userId, req.body);
      res.status(201).json(successResponse(report, 'Report submitted'));
    } catch (error) {
      next(error);
    }
  }

  async getMyReports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const reports = await reportsService.getMyReports(req.user!.userId);
      res.json(successResponse(reports, 'Reports retrieved'));
    } catch (error) {
      next(error);
    }
  }
}

export const reportsController = new ReportsController();