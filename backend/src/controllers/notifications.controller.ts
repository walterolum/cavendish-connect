import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notificationsService } from '../services/notifications.service';
import { successResponse } from '../utils/response';

export class NotificationsController {
  async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await notificationsService.getNotifications(req.user!.userId, page, limit);
      res.json(successResponse(result.notifications, 'Notifications retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.markAsRead(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.markAllAsRead(req.user!.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.getUnreadCount(req.user!.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();
