export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  universityAffiliation?: string;
  isEmailVerified?: boolean;
  /** Set when an admin issued a temporary password that must be replaced. */
  mustChangePassword?: boolean;
  roles: string[];
  counts?: Record<string, number>;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: Array<{ field: string; message: string }>;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  parentId?: number;
  sortOrder: number;
  isActive: boolean;
  children?: Category[];
  /** Live marketplace listings in this category (marketplace categories only). */
  _count?: { listings: number };
}

export interface ListingImage {
  id: number;
  url: string;
  alt?: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ListingOwner {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  location?: string;
  createdAt?: string;
  /** Approved verifications; non-empty means the owner is verified. */
  verificationRequests?: { type: string }[];
}

/** True when an admin has approved at least one verification for this person. */
export function isVerifiedOwner(owner?: Pick<ListingOwner, 'verificationRequests'> | null) {
  return Boolean(owner?.verificationRequests?.length);
}

export interface MarketplaceListing {
  id: number;
  title: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  condition: 'NEW' | 'USED_EXCELLENT' | 'USED_GOOD' | 'USED_FAIR';
  quantity: number;
  location?: string;
  status: string;
  isNegotiable: boolean;
  viewCount: number;
  featuredAt?: string;
  createdAt: string;
  updatedAt: string;
  category: Category;
  user?: ListingOwner;
  images: ListingImage[];
  isFavorited?: boolean;
}

export interface Service {
  id: number;
  title: string;
  slug: string;
  description: string;
  priceMin?: number;
  priceMax?: number;
  priceType?: string;
  currency: string;
  location?: string;
  availability?: string;
  status: string;
  viewCount: number;
  createdAt: string;
  serviceCategory: { id: number; name: string; slug: string; icon?: string; image?: string };
  user?: ListingOwner;
  images: ListingImage[];
  portfolios?: { id: number; title: string; description?: string; imageUrl?: string; link?: string }[];
  isFavorited?: boolean;
  averageRating?: number | null;
  reviewsCount?: number;
}

export interface Property {
  id: number;
  title: string;
  slug: string;
  description: string;
  propertyType: 'HOSTEL' | 'SINGLE_ROOM' | 'SHARED_ROOM' | 'APARTMENT' | 'HOUSE' | 'BEDSITTER' | 'OTHER';
  location: string;
  monthlyPrice: number;
  depositAmount?: number;
  currency: string;
  distanceFromCampus?: string;
  totalRooms: number;
  availableRooms: number;
  roomType?: string;
  isFurnished: boolean;
  hasWifi: boolean;
  hasWater: boolean;
  hasElectricity: boolean;
  hasSecurity: boolean;
  hasParking: boolean;
  rules?: string;
  status: string;
  viewCount?: number;
  averageRating?: number | null;
  reviewsCount?: number;
  createdAt: string;
  propertyCategory: { id: number; name: string; slug: string };
  user?: ListingOwner;
  images: ListingImage[];
  amenities?: { amenity: { id: number; name: string; icon?: string } }[];
  isFavorited?: boolean;
}