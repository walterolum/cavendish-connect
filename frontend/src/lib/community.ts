import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { ApiResponse } from '../types';

export interface CampusEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  category: string;
  startsAt: string;
  endsAt?: string | null;
  isPublished: boolean;
  createdAt: string;
}

export type CampusEventInput = Pick<CampusEvent, 'title' | 'category' | 'startsAt' | 'isPublished'> & {
  description?: string;
  location?: string;
  endsAt?: string;
};

export interface PublicStats {
  activeMembers: number;
  serviceProviders: number;
  liveListings: number;
  liveServices: number;
  liveProperties: number;
  averageRating: number | null;
  reviewCount: number;
}

export const eventsApi = {
  async upcoming(limit = 5): Promise<CampusEvent[]> {
    return (await api.get<ApiResponse<CampusEvent[]>>('/events', { params: { limit } })).data.data!;
  },
  async all(): Promise<CampusEvent[]> {
    return (await api.get<ApiResponse<CampusEvent[]>>('/events/all')).data.data!;
  },
  async create(input: CampusEventInput): Promise<CampusEvent> {
    return (await api.post<ApiResponse<CampusEvent>>('/events', input)).data.data!;
  },
  async update(id: number, input: CampusEventInput): Promise<CampusEvent> {
    return (await api.put<ApiResponse<CampusEvent>>(`/events/${id}`, input)).data.data!;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/events/${id}`);
  },
};

export function useUpcomingEvents(limit = 3) {
  return useQuery({ queryKey: ['events', 'upcoming', limit], queryFn: () => eventsApi.upcoming(limit), staleTime: 60_000 });
}

export function usePublicStats() {
  return useQuery({
    queryKey: ['stats', 'public'],
    queryFn: async () => (await api.get<ApiResponse<PublicStats>>('/stats/public')).data.data!,
    staleTime: 60_000,
  });
}

/** 1234 -> "1.2K", 12 -> "12". Real numbers, compact display. */
export function compactNumber(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
