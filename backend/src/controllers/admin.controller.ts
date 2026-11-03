import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminService, ListingKind } from '../services/admin.service';
import { successResponse } from '../utils/response';

export class AdminController {
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardStats();
      res.json(successResponse(stats, 'Dashboard stats retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, role, search, status } = req.query;
      const result = await adminService.listUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        role: role as string,
        search: search as string,
        status: status as string,
      });
      res.json(successResponse(result.users, 'Users retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.createUser(req.user!.userId, req.body);
      res.status(201).json(successResponse(result, 'Account created'));
    } catch (error) {
      next(error);
    }
  }

  async resetUserPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.resetUserPassword(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result, 'Temporary password issued'));
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.suspendUser(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async activateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.activateUser(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async changeUserRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { roleName } = req.body;
      const result = await adminService.changeUserRole(req.user!.userId, parseInt(req.params.id as string), roleName);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async listListings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, search } = req.query;
      const result = await adminService.listListings({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        search: search as string,
        kind: (req.params.kind as ListingKind) || 'marketplace',
      });
      res.json(successResponse(result.listings, 'Listings retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async updateListingStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;
      const result = await adminService.updateListingStatus(
        req.user!.userId,
        parseInt(req.params.id as string),
        status,
        (req.params.kind as ListingKind) || 'marketplace',
        reason
      );
      res.json(successResponse(result, 'Listing status updated'));
    } catch (error) {
      next(error);
    }
  }

  async listReports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, type } = req.query;
      const result = await adminService.listReports({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        type: type as string,
      });
      res.json(successResponse(result.reports, 'Reports retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async updateReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, resolution } = req.body;
      const result = await adminService.updateReportStatus(req.user!.userId, parseInt(req.params.id as string), status, resolution);
      res.json(successResponse(result, 'Report updated'));
    } catch (error) {
      next(error);
    }
  }

  async listVerifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, type } = req.query;
      const result = await adminService.listVerifications({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        type: type as string,
      });
      res.json(successResponse(result.verifications, 'Verifications retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async updateVerification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, rejectionReason } = req.body;
      const result = await adminService.updateVerificationStatus(
        req.user!.userId, parseInt(req.params.id as string), status, rejectionReason
      );
      res.json(successResponse(result, 'Verification updated'));
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await adminService.getSettings();
      res.json(successResponse(settings, 'Settings retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { settings } = req.body;
      const result = await adminService.updateSettings(req.user!.userId, settings);
      res.json(successResponse(result, 'Settings updated'));
    } catch (error) {
      next(error);
    }
  }

  async listAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, entity, action } = req.query;
      const result = await adminService.listAuditLogs({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        entity: entity as string,
        action: action as string,
      });
      res.json(successResponse(result.logs, 'Audit logs retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
