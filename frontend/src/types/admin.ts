export interface StatusCount {
  status: string;
  _count: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  listings: {
    marketplace: StatusCount[];
    services: StatusCount[];
    accommodation: StatusCount[];
  };
  reports: { total: number; open: number };
  revenue: string | number;
  pendingVerifications: number;
  recentUsers: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
  }[];
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  isActive: boolean;
  isSuspended: boolean;
  isEmailVerified: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  roles: string[];
  _count: {
    marketplaceListings: number;
    services: number;
    properties: number;
  };
}

export type ListingKind = 'marketplace' | 'service' | 'accommodation';

/** A post of any kind, in the shape the admin moderation API returns. */
export interface AdminListing {
  id: number;
  kind: ListingKind;
  userId: number;
  title: string;
  slug: string;
  description: string;
  price: string | number | null;
  priceMax: string | number | null;
  priceType: string | null;
  currency: string;
  location?: string | null;
  status: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  image: string | null;
  user: { id: number; username: string; firstName: string; lastName: string } | null;
  category: { id: number; name: string; slug: string } | null;
}

export interface AdminReport {
  id: number;
  reporterId: number;
  targetType: string;
  targetId: number;
  reason: string;
  description?: string | null;
  status: string;
  reviewedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: { id: number; username: string; firstName: string; lastName: string } | null;
  /** Summary of the reported item; null if it no longer exists. */
  target: {
    kind: ListingKind | 'user' | 'review';
    title: string;
    url: string | null;
    status: string;
    owner: { id: number; username: string; firstName: string; lastName: string } | null;
  } | null;
}

export interface AdminVerification {
  id: number;
  userId: number;
  type: string;
  status: string;
  documentUrl?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; username: string; firstName: string; lastName: string; email: string };
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  group: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: number; username: string; firstName: string; lastName: string } | null;
}

export interface AdminListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  type?: string;
  entity?: string;
  action?: string;
}