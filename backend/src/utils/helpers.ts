import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: { userId: number; email: string; roles: string[] }): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: { userId: number }): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): any {
  return jwt.verify(token, config.jwt.secret);
}

export function verifyRefreshToken(token: string): any {
  return jwt.verify(token, config.jwt.refreshSecret);
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .substring(0, 200);
}

/** Copy only the listed keys that are present, so request bodies can't set other columns. */
export function pickDefined<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Statuses anyone may view. Everything else is visible only to the owner and admins. */
export const PUBLIC_LISTING_STATUSES = ['ACTIVE', 'SOLD'];

export interface Viewer {
  userId: number;
  roles: string[];
}

export function canViewListing(status: string, ownerId: number, viewer?: Viewer): boolean {
  if (PUBLIC_LISTING_STATUSES.includes(status)) return true;
  if (!viewer) return false;
  return viewer.userId === ownerId || viewer.roles.includes('ADMIN');
}
