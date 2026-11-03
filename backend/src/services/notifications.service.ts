import prisma from '../config/database';
import { paginate } from '../utils/response';

export class NotificationsService {
  async getNotifications(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        include: {
          actor: {
            select: { id: true, username: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, meta: paginate(total, page, limit) };
  }

  async markAsRead(userId: number, notificationId: number) {
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new Error('Notification not found');
    if (notification.userId !== userId) throw new Error('Not your notification');

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: number) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: number) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount: count };
  }

  async createNotification(data: {
    userId: number;
    actorId?: number;
    type: string;
    title: string;
    message: string;
    targetType?: string;
    targetId?: number;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        actorId: data.actorId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        targetType: data.targetType,
        targetId: data.targetId,
      },
    });
  }
}

export const notificationsService = new NotificationsService();
