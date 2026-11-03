import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { queryClient } from '../lib/queryClient';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        // A different account must never see the previous account's cached data.
        queryClient.clear();
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set((s) => ({ user: { ...s.user, ...user } })),
      logout: () => {
        queryClient.clear();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    { name: 'cavconnect-auth' }
  )
);

export function hasRole(user: User | null, role: string): boolean {
  return !!user?.roles?.includes(role);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'ADMIN');
}
