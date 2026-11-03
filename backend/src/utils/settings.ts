import prisma from '../config/database';

/**
 * Admin-editable platform settings, cached briefly so every request
 * does not hit the database. Saving settings clears the cache.
 */
const TTL_MS = 15_000;
let cache: { at: number; values: Record<string, string> } | null = null;

export async function getSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const rows = await prisma.systemSetting.findMany({ select: { key: true, value: true } });
  cache = { at: Date.now(), values: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return cache.values;
}

export function clearSettingsCache() {
  cache = null;
}

export async function isMaintenanceMode() {
  return (await getSettings())['maintenance.mode'] === 'true';
}

/** The settings that are safe to show to anyone, e.g. in the site footer. */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    platformName: s['platform.name'] || 'CAV CONNECT',
    tagline: s['platform.tagline'] || '',
    currency: s['platform.currency'] || 'UGX',
    contactEmail: s['contact.email'] || '',
    contactPhone: s['contact.phone'] || '',
    maintenanceMode: s['maintenance.mode'] === 'true',
  };
}

/** Whether new and edited posts wait for an admin before going live. Off by default. */
export async function requiresReview() {
  return (await getSettings())['moderation.require_review'] === 'true';
}

/** Status for a brand-new post. */
export async function newPostStatus(): Promise<'ACTIVE' | 'PENDING_REVIEW'> {
  return (await requiresReview()) ? 'PENDING_REVIEW' : 'ACTIVE';
}

/**
 * Status after the owner edits a post. Decisions an admin made (suspended,
 * rejected) and finished sales are kept, so editing can't undo moderation.
 */
export async function editedPostStatus(current: string): Promise<string> {
  if (current === 'SUSPENDED' || current === 'REJECTED' || current === 'SOLD') return current;
  return (await requiresReview()) ? 'PENDING_REVIEW' : 'ACTIVE';
}
