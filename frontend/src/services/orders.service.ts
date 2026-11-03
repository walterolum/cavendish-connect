import { api } from '../lib/api';
import { ApiResponse, PaginationMeta } from '../types';

export type OrderTargetType = 'LISTING' | 'SERVICE' | 'PROPERTY';
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
export type OrderAction = 'accept' | 'decline' | 'complete' | 'cancel';

export interface OrderPerson {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface Order {
  id: number;
  buyerId: number;
  sellerId: number;
  targetType: OrderTargetType;
  targetId: number;
  title: string;
  unitPrice: string | number | null;
  currency: string;
  quantity: number;
  message: string | null;
  contactPhone: string;
  meetingPlace: string | null;
  preferredDate: string | null;
  status: OrderStatus;
  sellerNote: string | null;
  conversationId: number | null;
  respondedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: OrderPerson;
  seller: OrderPerson;
  target: { url: string; image: string | null; location: string | null } | null;
}

export interface NewOrder {
  targetType: OrderTargetType;
  targetId: number;
  quantity?: number;
  message?: string;
  contactPhone: string;
  meetingPlace?: string;
  preferredDate?: string;
}

export const ordersApi = {
  async create(input: NewOrder): Promise<Order> {
    return (await api.post<ApiResponse<Order>>('/orders', input)).data.data!;
  },
  async list(role: 'buyer' | 'seller', status?: string, page = 1): Promise<{ data: Order[]; meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<Order[]>>('/orders', { params: { role, status: status || undefined, page } });
    return { data: res.data.data!, meta: res.data.meta };
  },
  async counts(): Promise<{ incomingPending: number; myOpen: number }> {
    return (await api.get<ApiResponse<{ incomingPending: number; myOpen: number }>>('/orders/counts')).data.data!;
  },
  async act(id: number, action: OrderAction, note?: string): Promise<Order> {
    return (await api.patch<ApiResponse<Order>>(`/orders/${id}`, { action, note: note || undefined })).data.data!;
  },
};
