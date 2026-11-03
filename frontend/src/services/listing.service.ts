import { api } from '../lib/api';
import { Service, Property, ApiResponse, PaginationMeta, ListingImage } from '../types';

function imagesForm(files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  return form;
}

export const servicesApi = {
  async getServices(query: Record<string, unknown> = {}): Promise<{ data: Service[]; meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<Service[]>>('/services', { params: query });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async getService(slug: string): Promise<Service> {
    const res = await api.get<ApiResponse<Service>>(`/services/${slug}`);
    return res.data.data!;
  },

  async getMyServices(page = 1, limit = 20): Promise<{ data: Service[]; meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<Service[]>>('/services/my-services', { params: { page, limit } });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async createService(data: Record<string, unknown>): Promise<Service> {
    const res = await api.post<ApiResponse<Service>>('/services', data);
    return res.data.data!;
  },

  async updateService(id: number, data: Record<string, unknown>): Promise<Service> {
    const res = await api.put<ApiResponse<Service>>(`/services/${id}`, data);
    return res.data.data!;
  },

  async deleteService(id: number): Promise<void> {
    await api.delete(`/services/${id}`);
  },

  async addImages(id: number, files: File[]): Promise<ListingImage[]> {
    const res = await api.post<ApiResponse<ListingImage[]>>(`/services/${id}/images`, imagesForm(files), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data!;
  },
};

export const accommodationApi = {
  async getProperties(query: Record<string, unknown> = {}): Promise<{ data: Property[]; meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<Property[]>>('/accommodation', { params: query });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async getProperty(slug: string): Promise<Property> {
    const res = await api.get<ApiResponse<Property>>(`/accommodation/${slug}`);
    return res.data.data!;
  },

  async getMyProperties(page = 1, limit = 20): Promise<{ data: Property[]; meta?: PaginationMeta }> {
    const res = await api.get<ApiResponse<Property[]>>('/accommodation/my-properties', { params: { page, limit } });
    return { data: res.data.data!, meta: res.data.meta };
  },

  async createProperty(data: Record<string, unknown>): Promise<Property> {
    const res = await api.post<ApiResponse<Property>>('/accommodation', data);
    return res.data.data!;
  },

  async updateProperty(id: number, data: Record<string, unknown>): Promise<Property> {
    const res = await api.put<ApiResponse<Property>>(`/accommodation/${id}`, data);
    return res.data.data!;
  },

  async deleteProperty(id: number): Promise<void> {
    await api.delete(`/accommodation/${id}`);
  },

  async addImages(id: number, files: File[]): Promise<ListingImage[]> {
    const res = await api.post<ApiResponse<ListingImage[]>>(`/accommodation/${id}/images`, imagesForm(files), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data!;
  },
};
