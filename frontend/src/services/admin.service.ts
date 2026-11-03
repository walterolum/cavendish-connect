import { api } from '../lib/api';
import { ApiResponse, PaginationMeta } from '../types';
import {
  AdminListParams,
  AdminListing,
  AdminReport,
  AdminStats,
  AdminUser,
  AdminVerification,
  AuditLog,
  ListingKind,
  SystemSetting,
} from '../types/admin';

export interface NewAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone?: string;
  role: string;
}

export const adminApi = {
  async getDashboardStats(): Promise<AdminStats> {
    const res = await api.get<ApiResponse<AdminStats>>('/admin/dashboard/stats');
    return res.data.data!;
  },

  async getUsers(params: AdminListParams = {}): Promise<{ data: AdminUser[]; meta: PaginationMeta }> {
    const res = await api.get<ApiResponse<AdminUser[]>>('/admin/users', { params });
    return { data: res.data.data!, meta: res.data.meta! };
  },

  async createUser(input: NewAccountInput): Promise<{ user: { id: number; email: string; username: string; firstName: string; lastName: string }; tempPassword: string }> {
    const res = await api.post<ApiResponse<{ user: { id: number; email: string; username: string; firstName: string; lastName: string }; tempPassword: string }>>('/admin/users', input);
    return res.data.data!;
  },

  async resetUserPassword(id: number): Promise<{ tempPassword: string }> {
    const res = await api.post<ApiResponse<{ tempPassword: string }>>(`/admin/users/${id}/reset-password`);
    return res.data.data!;
  },

  async suspendUser(id: number): Promise<void> {
    await api.put(`/admin/users/${id}/suspend`);
  },

  async activateUser(id: number): Promise<void> {
    await api.put(`/admin/users/${id}/activate`);
  },

  async changeUserRole(id: number, roleName: string): Promise<void> {
    await api.put(`/admin/users/${id}/role`, { roleName });
  },

  async getListings(
    kind: ListingKind,
    params: AdminListParams = {}
  ): Promise<{ data: AdminListing[]; meta: PaginationMeta }> {
    const res = await api.get<ApiResponse<AdminListing[]>>(`/admin/listings/${kind}`, { params });
    return { data: res.data.data!, meta: res.data.meta! };
  },

  async updateListingStatus(kind: ListingKind, id: number, status: string, reason?: string): Promise<void> {
    await api.put(`/admin/listings/${kind}/${id}/status`, { status, reason: reason || undefined });
  },

  async getReports(params: AdminListParams = {}): Promise<{ data: AdminReport[]; meta: PaginationMeta }> {
    const res = await api.get<ApiResponse<AdminReport[]>>('/admin/reports', { params });
    return { data: res.data.data!, meta: res.data.meta! };
  },

  async updateReport(id: number, body: { status: string; resolution?: string }): Promise<void> {
    await api.put(`/admin/reports/${id}`, body);
  },

  async getVerifications(params: AdminListParams = {}): Promise<{ data: AdminVerification[]; meta: PaginationMeta }> {
    const res = await api.get<ApiResponse<AdminVerification[]>>('/admin/verification', { params });
    return { data: res.data.data!, meta: res.data.meta! };
  },

  async updateVerification(id: number, body: { status: string; rejectionReason?: string }): Promise<void> {
    await api.put(`/admin/verification/${id}`, body);
  },

  async getSettings(): Promise<SystemSetting[]> {
    const res = await api.get<ApiResponse<SystemSetting[]>>('/admin/settings');
    return res.data.data!;
  },

  async updateSettings(settings: { key: string; value: string }[]): Promise<SystemSetting[]> {
    const res = await api.put<ApiResponse<SystemSetting[]>>('/admin/settings', { settings });
    return res.data.data!;
  },

  async getAuditLogs(params: AdminListParams = {}): Promise<{ data: AuditLog[]; meta: PaginationMeta }> {
    const res = await api.get<ApiResponse<AuditLog[]>>('/admin/audit-logs', { params });
    return { data: res.data.data!, meta: res.data.meta! };
  },
};