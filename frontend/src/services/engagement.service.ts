import { api } from '../lib/api';
import { ApiResponse, ListingOwner, PaginationMeta } from '../types';

// ─── Messaging ──────────────────────────────────────────────────

export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'LOCATION' | 'CALL';

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  durationSec?: number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  liveUntil?: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: ListingOwner;
}

export type ChatPerson = ListingOwner & { online?: boolean };

export interface ConversationSummary {
  id: number;
  otherUser: ChatPerson | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationDetail {
  id: number;
  otherUser: ChatPerson | null;
  messages: ChatMessage[];
}

export interface NewMessage {
  content?: string;
  type?: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentSize?: number;
  durationSec?: number;
  latitude?: number;
  longitude?: number;
  liveMinutes?: number;
}

export interface UploadedFile {
  url: string;
  name: string;
  mime: string;
  size: number;
}

/** Short label for a message in lists and notifications. */
export function messagePreview(m: Pick<ChatMessage, 'type' | 'content' | 'attachmentName' | 'liveUntil'>) {
  switch (m.type) {
    case 'IMAGE': return m.content ? `📷 ${m.content}` : '📷 Photo';
    case 'AUDIO': return '🎤 Voice note';
    case 'FILE': return `📄 ${m.attachmentName ?? 'Document'}`;
    case 'LOCATION': return m.liveUntil && new Date(m.liveUntil) > new Date() ? '📍 Live location' : '📍 Location';
    case 'CALL': return `📞 ${m.content || 'Call'}`;
    default: return m.content;
  }
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
  async send(conversationId: number | string, message: string | NewMessage): Promise<ChatMessage> {
    const body = typeof message === 'string' ? { content: message } : message;
    const res = await api.post<ApiResponse<ChatMessage>>(`/messages/conversations/${conversationId}/messages`, body);
    return res.data.data!;
  },
  async upload(file: Blob, name: string, onProgress?: (pct: number) => void): Promise<UploadedFile> {
    const form = new FormData();
    form.append('file', file, name);
    const res = await api.post<ApiResponse<UploadedFile>>('/messages/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
    return res.data.data!;
  },
  async typing(conversationId: number | string): Promise<void> {
    await api.post(`/messages/conversations/${conversationId}/typing`);
  },
  async signal(conversationId: number | string, payload: Record<string, unknown>): Promise<{ delivered: boolean }> {
    const res = await api.post<ApiResponse<{ delivered: boolean }>>(`/messages/conversations/${conversationId}/signal`, payload);
    return res.data.data!;
  },
  async moveLiveLocation(messageId: number, latitude: number, longitude: number): Promise<void> {
    await api.patch(`/messages/${messageId}/location`, { latitude, longitude });
  },
  async stopLiveLocation(messageId: number): Promise<void> {
    await api.post(`/messages/${messageId}/location/stop`);
  },
  async iceServers(): Promise<RTCIceServer[]> {
    const res = await api.get<ApiResponse<RTCIceServer[]>>('/realtime/ice');
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
