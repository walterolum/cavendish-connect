import { api } from '../lib/api';
import { ApiResponse, MarketplaceListing, Service, Property } from '../types';

export const FAVORITE_TYPES = ['MARKETPLACE', 'SERVICE', 'ACCOMMODATION'] as const;

export type FavoriteType = (typeof FAVORITE_TYPES)[number];

export interface Favorite {
  id: number;
  targetType: FavoriteType;
  targetId: number;
  createdAt: string;
  target: MarketplaceListing | Service | Property | null;
}

export const favoritesApi = {
  async getFavorites(type?: string): Promise<Favorite[]> {
    const res = await api.get<ApiResponse<Favorite[]>>('/favorites', {
      params: type ? { type } : {},
    });
    return res.data.data!;
  },

  async toggleFavorite(targetType: string, targetId: number): Promise<{ favorited: boolean }> {
    const res = await api.post<ApiResponse<{ favorited: boolean }>>('/favorites/toggle', {
      targetType,
      targetId,
    });
    return res.data.data!;
  },

  async checkFavorited(targetType: string, targetId: number): Promise<boolean> {
    const res = await api.get<ApiResponse<{ isFavorited: boolean }>>('/favorites/check', {
      params: { targetType, targetId },
    });
    return res.data.data!.isFavorited;
  },
};