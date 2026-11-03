import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { messagesController } from '../controllers/messages.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.post('/conversations', authenticate, [
  body('userId').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  validate,
], messagesController.createOrGetConversation);

router.get('/conversations', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
], messagesController.getConversations);

router.get('/conversations/:id', authenticate, [
  param('id').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
], messagesController.getConversationMessages);

router.post('/conversations/:id/messages', authenticate, [
  param('id').isInt({ min: 1 }),
  body('content').trim().notEmpty().isLength({ max: 5000 }).withMessage('Message content is required'),
  validate,
], messagesController.sendMessage);

router.get('/unread-count', authenticate, messagesController.getUnreadCount);

export default router;
