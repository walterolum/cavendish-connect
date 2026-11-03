import { api } from '../lib/api';
import { MarketplaceListing, ApiResponse, PaginationMeta, Category } from '../types';

export interface ListingQuery {
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  search?: string;
  sort?: string;
  location?: string;
}

export interface ListingListResult {
  data: MarketplaceListing[];
  meta: PaginationMeta | undefined;
}

export const marketplaceApi = {
  async getListings(query: ListingQuery = {}): Promise<ListingListResult> {
    const res = await api.get<ApiResponse<MarketplaceListing[]>>('/marketplace', { params: query });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async getListing(slug: string): Promise<MarketplaceListing> {
    const res = await api.get<ApiResponse<MarketplaceListing>>(`/marketplace/${slug}`);
    return res.data.data!;
  },

  async getMyListings(page = 1, limit = 20): Promise<ListingListResult> {
    const res = await api.get<ApiResponse<MarketplaceListing[]>>('/marketplace/my-listings', { params: { page, limit } });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async createListing(data: {
    title: string;
    description: string;
    categoryId: number;
    price: number;
    currency?: string;
    condition: string;
    quantity?: number;
    location?: string;
    isNegotiable?: boolean;
  }): Promise<MarketplaceListing> {
    const res = await api.post<ApiResponse<MarketplaceListing>>('/marketplace', data);
    return res.data.data!;
  },

  async updateListing(id: number, data: Partial<any>): Promise<MarketplaceListing> {
    const res = await api.put<ApiResponse<MarketplaceListing>>(`/marketplace/${id}`, data);
    return res.data.data!;
  },

  async deleteListing(id: number): Promise<void> {
    await api.delete(`/marketplace/${id}`);
  },

  async addImages(id: number, files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const res = await api.post(`/marketplace/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};

export const categoriesApi = {
  async getCategories(): Promise<Category[]> {
    const res = await api.get<ApiResponse<Category[]>>('/categories');
    return res.data.data!;
  },

  async getServiceCategories(): Promise<Category[]> {
    const res = await api.get<ApiResponse<Category[]>>('/categories/services');
    return res.data.data!;
  },

  async getPropertyCategories(): Promise<Category[]> {
    const res = await api.get<ApiResponse<Category[]>>('/categories/properties');
    return res.data.data!;
  },
};