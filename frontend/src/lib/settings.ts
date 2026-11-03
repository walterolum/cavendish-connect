import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { ApiResponse } from '../types';

export interface PublicSettings {
  platformName: string;
  tagline: string;
  currency: string;
  contactEmail: string;
  contactPhone: string;
  maintenanceMode: boolean;
}

/** Admin-controlled platform settings that anyone may see (footer contacts, maintenance notice). */
export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: async () => (await api.get<ApiResponse<PublicSettings>>('/settings/public')).data.data!,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
