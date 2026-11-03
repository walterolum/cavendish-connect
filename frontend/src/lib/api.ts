import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/auth';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// One refresh at a time: parallel 401s wait for the same refresh instead of racing.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: next } = res.data.data;
    useAuthStore.getState().setTokens(accessToken, next);
    return accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      // Session is over: clear it so the UI shows the signed-out state.
      if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: any, fallback: string = 'Something went wrong'): string {
  if (error?.response?.data?.errors?.length) {
    return error.response.data.errors[0].message;
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.code === 'ECONNABORTED') return 'The request took too long. Check your connection and try again.';
  if (error?.message === 'Network Error') return "Can't reach the server. Check your connection and try again.";
  return fallback;
}

export function isNotFound(error: any) {
  return error?.response?.status === 404;
}
