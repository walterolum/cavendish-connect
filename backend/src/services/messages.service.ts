import prisma from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { paginate } from '../utils/response';

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
        otherUser: otherParticipant?.user || null,
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
    if (!conversation.participants.some(p => p.userId === userId)) throw new ForbiddenError('Not a participant');
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

    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    // Fetched newest-first for paging; returned oldest-first for display.
    return {
      conversation: { id: conversation.id, otherUser },
      messages: messages.reverse(),
      meta: paginate(total, page, limit),
    };
  }

  async sendMessage(userId: number, conversationId: number, content: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { where: { userId } } },
    });

    if (!conversation) throw new NotFoundError('Conversation');
    if (conversation.participants.length === 0) throw new ForbiddenError('Not a participant');

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
      },
      include: {
        sender: {
          select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: userId } },
    });

    for (const participant of participants) {
      await prisma.notification.create({
        data: {
          userId: participant.userId,
          actorId: userId,
          type: 'NEW_MESSAGE',
          title: 'New message',
          message: content.substring(0, 200),
          targetType: 'CONVERSATION',
          targetId: conversationId,
        },
      });
    }

    return message;
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
