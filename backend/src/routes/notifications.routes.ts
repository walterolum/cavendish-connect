import { Router } from 'express';
import { param, query } from 'express-validator';
import { notificationsController } from '../controllers/notifications.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
], notificationsController.getNotifications);

router.put('/:id/read', authenticate, [
  param('id').isInt({ min: 1 }),
  validate,
], notificationsController.markAsRead);

router.put('/read-all', authenticate, notificationsController.markAllAsRead);

router.get('/unread-count', authenticate, notificationsController.getUnreadCount);

export default router;
