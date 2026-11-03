import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { ApiResponse } from '../types';

/** Everything an admin can change in Admin > Appearance. */
export interface Brand {
  appName: string;
  tagline: string;
  universityName: string;
  universityShort: string;
  location: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  heroMarket: string;
  heroServices: string;
  heroStays: string;
  seoDescription: string;
}

export const DEFAULT_BRAND: Brand = {
  appName: 'Cavendish Connect',
  tagline: 'Connect. Buy. Sell. Serve. Find.',
  universityName: 'Cavendish University Uganda',
  universityShort: 'Cavendish',
  location: 'Kampala, Uganda',
  primaryColor: '#1442a3',
  accentColor: '#ffc81f',
  logoUrl: '',
  heroMarket: '/images/campus-hero.jpg',
  heroServices: '/images/campus-hero.jpg',
  heroStays: '/images/stays-hero-alt.jpg',
  seoDescription: 'The campus marketplace, services hub and student accommodation platform.',
};

export interface PublicSettings {
  brand: Brand;
  platformName: string;
  tagline: string;
  currency: string;
  contactEmail: string;
  contactPhone: string;
  maintenanceMode: boolean;
}

/** Admin-controlled platform settings that anyone may see (branding, footer contacts, maintenance notice). */
export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: async () => (await api.get<ApiResponse<PublicSettings>>('/settings/public')).data.data!,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/** The platform's name, university, images and colours, with defaults while loading. */
export function useBrand(): Brand & { initials: string; city: string } {
  const { data } = usePublicSettings();
  const b = { ...DEFAULT_BRAND, ...(data?.brand ?? {}) };
  // "Cavendish University Uganda" -> "CU"; used by the drawn crest when there is no logo.
  const words = b.universityName.split(/\s+/).filter((w) => w && !/^(of|the|and|for|&)$/i.test(w));
  const initials = (words.length >= 2 ? words[0][0] + words[1][0] : b.universityShort.slice(0, 2)).toUpperCase();
  return { ...b, initials, city: b.location.split(',')[0].trim() };
}
