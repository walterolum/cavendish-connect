import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { messagesService } from '../services/messages.service';
import { successResponse } from '../utils/response';

export class MessagesController {
  async createOrGetConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;
      const conversation = await messagesService.createOrGetConversation(
        req.user!.userId,
        parseInt(userId)
      );
      res.json(successResponse(conversation, 'Conversation retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await messagesService.getConversations(req.user!.userId, page, limit);
      res.json(successResponse(result.conversations, 'Conversations retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async getConversationMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await messagesService.getConversationMessages(
        req.user!.userId,
        parseInt(req.params.id as string),
        page,
        limit
      );
      res.json(successResponse({ ...result.conversation, messages: result.messages }, 'Messages retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { content, type, attachmentUrl, attachmentName, attachmentMime, attachmentSize, durationSec, latitude, longitude, liveMinutes } = req.body;
      const message = await messagesService.sendMessage(req.user!.userId, parseInt(req.params.id as string), {
        content: content ?? '',
        type,
        attachmentUrl,
        attachmentName,
        attachmentMime,
        attachmentSize: attachmentSize != null ? Number(attachmentSize) : undefined,
        durationSec: durationSec != null ? Number(durationSec) : undefined,
        latitude: latitude != null ? Number(latitude) : undefined,
        longitude: longitude != null ? Number(longitude) : undefined,
        liveMinutes: liveMinutes != null ? Number(liveMinutes) : undefined,
      });
      res.status(201).json(successResponse(message, 'Message sent'));
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await messagesService.getUnreadCount(req.user!.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

export const messagesController = new MessagesController();
