import { Router, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { messagesController } from '../controllers/messages.controller';
import { authenticate, requireVerified, AuthRequest } from '../middleware/auth';
import { chatUpload } from '../middleware/upload';
import { storeChatFile } from '../utils/storage';
import { messagesService } from '../services/messages.service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';
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
  body('type').optional().isIn(['TEXT', 'IMAGE', 'AUDIO', 'FILE', 'LOCATION', 'CALL']),
  body('content').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }),
  body('attachmentUrl').optional().isString().isLength({ max: 600 }),
  body('attachmentName').optional().isString().isLength({ max: 180 }),
  body('attachmentMime').optional().isString().isLength({ max: 100 }),
  body('attachmentSize').optional().isInt({ min: 0, max: 50 * 1024 * 1024 }),
  body('durationSec').optional().isInt({ min: 0, max: 24 * 3600 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('liveMinutes').optional().isInt({ min: 1, max: 480 }),
  validate,
], messagesController.sendMessage);

// Photo, voice note or PDF for a chat message (sent with the message afterwards).
router.post('/uploads', authenticate, requireVerified, chatUpload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new BadRequestError('Choose a file to send');
    res.status(201).json(successResponse(await storeChatFile(req.file), 'File uploaded'));
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:id/typing', authenticate, [param('id').isInt({ min: 1 }), validate], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await messagesService.typing(req.user!.userId, parseInt(req.params.id as string));
    res.json(successResponse(null));
  } catch (error) {
    next(error);
  }
});

// Voice/video call signalling between the two people in a conversation.
router.post('/conversations/:id/signal', authenticate, [
  param('id').isInt({ min: 1 }),
  body('kind').isIn(['ring', 'accept', 'decline', 'busy', 'offer', 'answer', 'ice', 'end', 'media']),
  body('callId').isString().isLength({ min: 6, max: 64 }),
  validate,
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { kind, callId, video, sdp, candidate, state } = req.body;
    if (JSON.stringify(req.body).length > 20_000) throw new BadRequestError('Signal too large');
    res.json(successResponse(await messagesService.signal(req.user!.userId, parseInt(req.params.id as string), { kind, callId, video, sdp, candidate, state })));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/location', authenticate, [
  param('id').isInt({ min: 1 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  validate,
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(await messagesService.updateLiveLocation(req.user!.userId, parseInt(req.params.id as string), req.body.latitude, req.body.longitude)));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/location/stop', authenticate, [param('id').isInt({ min: 1 }), validate], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(await messagesService.stopLiveLocation(req.user!.userId, parseInt(req.params.id as string))));
  } catch (error) {
    next(error);
  }
});

router.get('/unread-count', authenticate, messagesController.getUnreadCount);

export default router;
