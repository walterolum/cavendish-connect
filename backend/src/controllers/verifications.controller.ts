import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { verificationsService } from '../services/verifications.service';
import { successResponse } from '../utils/response';

export class VerificationsController {
  async submitRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const request = await verificationsService.submitRequest(req.user!.userId, req.body);
      res.status(201).json(successResponse(request, 'Verification request submitted'));
    } catch (error) {
      next(error);
    }
  }

  async getMyRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const requests = await verificationsService.getMyRequests(req.user!.userId);
      res.json(successResponse(requests, 'Verification requests retrieved'));
    } catch (error) {
      next(error);
    }
  }
}

export const verificationsController = new VerificationsController();