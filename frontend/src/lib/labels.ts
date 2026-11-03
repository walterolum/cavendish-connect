/**
 * Display labels for every enum the API returns. Pages must use these instead
 * of local maps, so the same value always reads the same way everywhere.
 */
import type { BadgeVariant } from '../components/ui/badge';

type StatusMeta = { label: string; variant: BadgeVariant; hint?: string };

const STATUS: Record<string, StatusMeta> = {
  // Listings, services, properties
  ACTIVE: { label: 'Live', variant: 'green', hint: 'Visible to everyone' },
  PENDING_REVIEW: { label: 'In review', variant: 'amber', hint: 'Our team checks new and edited posts, usually within a day' },
  DRAFT: { label: 'Draft', variant: 'gray', hint: 'Only you can see this' },
  SOLD: { label: 'Sold', variant: 'gray', hint: 'Marked as sold' },
  EXPIRED: { label: 'Expired', variant: 'gray', hint: 'No longer shown in search' },
  REJECTED: { label: 'Rejected', variant: 'red', hint: 'Did not meet the community guidelines' },
  SUSPENDED: { label: 'Suspended', variant: 'red', hint: 'Hidden by a moderator' },
  PUBLISHED: { label: 'Published', variant: 'green' },
  INACTIVE: { label: 'Inactive', variant: 'gray' },
  // Reports
  OPEN: { label: 'Open', variant: 'brand' },
  UNDER_REVIEW: { label: 'Under review', variant: 'amber' },
  RESOLVED: { label: 'Resolved', variant: 'green' },
  // Verifications
  PENDING: { label: 'Pending', variant: 'amber' },
  VERIFIED: { label: 'Verified', variant: 'green' },
  // Payments
  SUCCESSFUL: { label: 'Paid', variant: 'green' },
  FAILED: { label: 'Failed', variant: 'red' },
  CANCELLED: { label: 'Cancelled', variant: 'gray' },
  REFUNDED: { label: 'Refunded', variant: 'gray' },
};

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function statusMeta(status: string): StatusMeta {
  return STATUS[status] ?? { label: humanize(status), variant: 'gray' };
}

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  USED_EXCELLENT: 'Used · Excellent',
  USED_GOOD: 'Used · Good',
  USED_FAIR: 'Used · Fair',
};

export const CONDITION_SHORT: Record<string, string> = {
  NEW: 'New',
  USED_EXCELLENT: 'Like new',
  USED_GOOD: 'Good',
  USED_FAIR: 'Fair',
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  HOSTEL: 'Hostel',
  SINGLE_ROOM: 'Single room',
  SHARED_ROOM: 'Shared room',
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  BEDSITTER: 'Bedsitter',
  OTHER: 'Other',
};

export const PRICE_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixed price',
  hourly: 'Per hour',
  daily: 'Per day',
  negotiable: 'Negotiable',
  quote: 'On quote',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  MODERATOR: 'Moderator',
  STUDENT: 'Student',
  SERVICE_PROVIDER: 'Service provider',
  LANDLORD: 'Landlord',
  BUSINESS: 'Business',
  VENDOR: 'Vendor / business',
  USER: 'Member',
};

export const label = (map: Record<string, string>, value?: string | null) =>
  value ? map[value] ?? humanize(value) : '';
