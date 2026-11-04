import prisma from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { isOnline, publish } from '../realtime/hub';
import { paginate } from '../utils/response';

const SENDER = { id: true, username: true, firstName: true, lastName: true, avatar: true } as const;

export interface MessageInput {
  content?: string;
  type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'LOCATION' | 'CALL';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentSize?: number;
  durationSec?: number;
  latitude?: number;
  longitude?: number;
  /** For a live location: how long to keep sharing. */
  liveMinutes?: number;
}

/** Attachments must be files we stored, never arbitrary links. */
function isOwnUpload(url?: string) {
  return !!url && /^(\/uploads\/[\w.-]+|https:\/\/res\.cloudinary\.com\/[^\s"'<>]+)$/.test(url);
}

/** Short text for notifications and the conversation list. */
export function previewText(m: { type: string; content: string; durationSec?: number | null; liveUntil?: Date | null; attachmentName?: string | null }) {
  switch (m.type) {
    case 'IMAGE': return m.content ? `Photo: ${m.content}` : 'Sent a photo';
    case 'AUDIO': return 'Voice note';
    case 'FILE': return `Document: ${m.attachmentName ?? 'file'}`;
    case 'LOCATION': return m.liveUntil ? 'Sharing live location' : 'Shared a location';
    case 'CALL': return m.content || 'Call';
    default: return m.content;
  }
}

export class MessagesService {
  async createOrGetConversation(userId: number, otherUserId: number) {
    if (userId === otherUserId) {
      throw new BadRequestError('Cannot create conversation with yourself');
    }

    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) throw new NotFoundError('User');

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    const conversation = await prisma.conversation.create({
      data: {
        createdBy: userId,
        participants: {
          create: [
            { userId },
            { userId: otherUserId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
      },
    });

    return conversation;
  }

  async getConversations(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          participants: { some: { userId } },
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, username: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conversation.count({
        where: { participants: { some: { userId } } },
      }),
    ]);

    const unreadGroups = conversations.length
      ? await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversations.map(c => c.id) },
            senderId: { not: userId },
            isRead: false,
          },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unreadGroups.map(g => [g.conversationId, g._count._all]));

    const result = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        title: conv.title,
        otherUser: otherParticipant?.user ? { ...otherParticipant.user, online: isOnline(otherParticipant.user.id) } : null,
        lastMessage,
        unreadCount: unreadByConversation.get(conv.id) || 0,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    return { conversations: result, meta: paginate(total, page, limit) };
  }

  async getConversationMessages(userId: number, conversationId: number, page: number = 1, limit: number = 50) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundError('Conversation');
    if (!conversation.participants.some((p) => p.userId === userId)) throw new ForbiddenError('Not a participant');
    const otherUser = conversation.participants.find(p => p.userId !== userId)?.user || null;

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });

    const marked = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
    // Tell the other person their messages were read (the ✓✓ ticks).
    if (marked.count > 0 && otherUser) publish(otherUser.id, 'read', { conversationId, readerId: userId, at: new Date().toISOString() });

    // Fetched newest-first for paging; returned oldest-first for display.
    return {
      conversation: { id: conversation.id, otherUser: otherUser ? { ...otherUser, online: isOnline(otherUser.id) } : null },
      messages: messages.reverse(),
      meta: paginate(total, page, limit),
    };
  }

  async sendMessage(userId: number, conversationId: number, input: string | MessageInput) {
    const data: MessageInput = typeof input === 'string' ? { content: input } : input;
    const type = data.type ?? 'TEXT';
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });

    if (!conversation) throw new NotFoundError('Conversation');
    if (!conversation.participants.some((p) => p.userId === userId)) throw new ForbiddenError('Not a participant');
    if (type === 'TEXT' && !data.content?.trim()) throw new BadRequestError('Message is empty');
    if (['IMAGE', 'AUDIO', 'FILE'].includes(type) && !isOwnUpload(data.attachmentUrl)) {
      throw new BadRequestError('Attachment must be uploaded first');
    }
    if (type === 'LOCATION' && (data.latitude == null || data.longitude == null)) throw new BadRequestError('Location is missing');

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type,
        content: (data.content ?? '').trim(),
        attachmentUrl: data.attachmentUrl ?? null,
        attachmentName: data.attachmentName?.slice(0, 180) ?? null,
        attachmentMime: data.attachmentMime ?? null,
        attachmentSize: data.attachmentSize ?? null,
        durationSec: data.durationSec ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        liveUntil: data.liveMinutes ? new Date(Date.now() + data.liveMinutes * 60_000) : null,
      },
      include: { sender: { select: SENDER } },
    });

    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    const others = conversation.participants.map((p) => p.userId).filter((id) => id !== userId);
    // Live delivery to everyone in the chat, including the sender's other tabs.
    publish([...others, userId], 'message', { conversationId, message });

    const preview = previewText(message);
    for (const id of others) {
      await prisma.notification.create({
        data: {
          userId: id,
          actorId: userId,
          type: 'NEW_MESSAGE',
          title: `New message from ${message.sender.firstName}`,
          message: preview.substring(0, 200),
          targetType: 'CONVERSATION',
          targetId: conversationId,
        },
      });
    }

    return message;
  }

  private async participantIds(userId: number, conversationId: number) {
    const rows = await prisma.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } });
    if (!rows.some((r) => r.userId === userId)) throw new ForbiddenError('Not a participant');
    return rows.map((r) => r.userId).filter((id) => id !== userId);
  }

  /** "Walter is typing…" */
  async typing(userId: number, conversationId: number) {
    publish(await this.participantIds(userId, conversationId), 'typing', { conversationId, userId });
  }

  /** Call signalling (ring, answer, network details, hang up) between the two people in a chat. */
  async signal(userId: number, conversationId: number, payload: Record<string, unknown>) {
    const others = await this.participantIds(userId, conversationId);
    const from = await prisma.user.findUnique({ where: { id: userId }, select: SENDER });
    publish(others, 'call', { ...payload, conversationId, from });
    return { delivered: others.some((id) => isOnline(id)) };
  }

  /** Moves the pin of a live location while it is being shared. */
  async updateLiveLocation(userId: number, messageId: number, latitude: number, longitude: number) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.senderId !== userId || msg.type !== 'LOCATION') throw new NotFoundError('Live location');
    if (!msg.liveUntil || msg.liveUntil < new Date()) throw new BadRequestError('Live sharing has ended');
    const updated = await prisma.message.update({ where: { id: messageId }, data: { latitude, longitude }, include: { sender: { select: SENDER } } });
    publish([...(await this.participantIds(userId, msg.conversationId)), userId], 'message:update', { conversationId: msg.conversationId, message: updated });
    return updated;
  }

  async stopLiveLocation(userId: number, messageId: number) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.senderId !== userId || msg.type !== 'LOCATION') throw new NotFoundError('Live location');
    const updated = await prisma.message.update({ where: { id: messageId }, data: { liveUntil: new Date() }, include: { sender: { select: SENDER } } });
    publish([...(await this.participantIds(userId, msg.conversationId)), userId], 'message:update', { conversationId: msg.conversationId, message: updated });
    return updated;
  }

  async getUnreadCount(userId: number) {
    const count = await prisma.message.count({
      where: {
        conversation: {
          participants: { some: { userId } },
        },
        senderId: { not: userId },
        isRead: false,
      },
    });

    return { unreadCount: count };
  }
}

export const messagesService = new MessagesService();
