import { api } from '../lib/api';
import { ApiResponse, PaginationMeta } from '../types';

export interface NotificationActor {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  targetType?: string | null;
  targetId?: number | null;
  createdAt: string;
  actor?: NotificationActor | null;
}

export const notificationsApi = {
  async getNotifications(): Promise<{ data: AppNotification[]; meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<AppNotification[]>>('/notifications', { params: { limit: 50 } });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async markAsRead(id: number): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async unreadCount(): Promise<number> {
    const res = await api.get<ApiResponse<{ unreadCount: number }>>('/notifications/unread-count');
    return res.data.data!.unreadCount;
  },
};