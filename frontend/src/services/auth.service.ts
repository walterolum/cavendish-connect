import { api } from '../lib/api';
import { AuthResponse, User, ApiResponse } from '../types';

export const authApi = {
  async register(data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: string;
  }): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return res.data.data!;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password });
    return res.data.data!;
  },

  async getProfile(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/profile');
    return res.data.data!;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const res = await api.put<ApiResponse<User>>('/auth/profile', data);
    return res.data.data!;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  /** Best-effort server logout; the session is cleared locally either way. */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      /* already signed out on the server, or offline */
    }
  },
};