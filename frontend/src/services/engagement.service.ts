import { api } from '../lib/api';
import { ApiResponse, ListingOwner, PaginationMeta } from '../types';

// ─── Messaging ──────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: number;
  otherUser: ListingOwner | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationDetail {
  id: number;
  otherUser: ListingOwner | null;
  messages: ChatMessage[];
}

export const messagesApi = {
  async list(): Promise<ConversationSummary[]> {
    const res = await api.get<ApiResponse<ConversationSummary[]>>('/messages/conversations', { params: { limit: 50 } });
    return res.data.data!;
  },
  async get(id: number | string): Promise<ConversationDetail> {
    const res = await api.get<ApiResponse<ConversationDetail>>(`/messages/conversations/${id}`, {
      params: { limit: 100 },
    });
    return res.data.data!;
  },
  async start(userId: number): Promise<{ id: number }> {
    const res = await api.post<ApiResponse<{ id: number }>>('/messages/conversations', { userId });
    return res.data.data!;
  },
  async send(conversationId: number | string, content: string): Promise<ChatMessage> {
    const res = await api.post<ApiResponse<ChatMessage>>(`/messages/conversations/${conversationId}/messages`, {
      content,
    });
    return res.data.data!;
  },
  async unreadCount(): Promise<number> {
    const res = await api.get<ApiResponse<{ unreadCount: number }>>('/messages/unread-count');
    return res.data.data!.unreadCount;
  },
};

// ─── Reviews ────────────────────────────────────────────────────

/** Reviews always rate a person; the type says in which role. */
export type ReviewTargetType = 'SELLER' | 'SERVICE_PROVIDER' | 'LANDLORD' | 'BUSINESS';

export interface Review {
  id: number;
  rating: number;
  title?: string | null;
  content?: string | null;
  createdAt: string;
  author: ListingOwner;
}

export interface ReviewSummary {
  reviews: Review[];
  averageRating: number | null;
  totalReviews: number;
}

export const reviewsApi = {
  async list(targetType: ReviewTargetType, userId: number): Promise<ReviewSummary & { meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<ReviewSummary>>(`/reviews/${targetType}/${userId}`, { params: { limit: 20 } });
    return { ...res.data.data!, meta: res.data.meta };
  },
  async create(input: { targetType: ReviewTargetType; targetId: number; rating: number; title?: string; content?: string }) {
    const res = await api.post<ApiResponse<Review>>('/reviews', input);
    return res.data.data!;
  },
  async remove(id: number) {
    await api.delete(`/reviews/${id}`);
  },
};
