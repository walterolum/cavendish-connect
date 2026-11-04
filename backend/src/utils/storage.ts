import crypto from 'crypto';
import { config } from '../config';
import { AppError } from './errors';

/**
 * Where uploaded photos are kept.
 *   STORAGE_PROVIDER=local       files on this server's disk, served from /uploads
 *                                (needs a persistent disk in production)
 *   STORAGE_PROVIDER=cloudinary  files on Cloudinary; set CLOUDINARY_URL to the
 *                                "API environment variable" from the Cloudinary
 *                                dashboard: cloudinary://<key>:<secret>@<cloud>
 */
export const usesCloudinary = config.storage.provider === 'cloudinary';

function cloudinaryCredentials() {
  const raw = process.env.CLOUDINARY_URL ?? '';
  const m = raw.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new AppError('Photo storage is not configured (CLOUDINARY_URL is missing or invalid)', 500);
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

if (usesCloudinary) cloudinaryCredentials(); // fail at start-up, not on the first upload

const FOLDER = 'cavendish-connect';

type ResourceType = 'image' | 'video' | 'raw';

async function uploadToCloudinary(file: Express.Multer.File, resourceType: ResourceType = 'image'): Promise<string> {
  const { apiKey, apiSecret, cloudName } = cloudinaryCredentials();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Signed upload: the signature covers every parameter except the file and key.
  const signature = crypto.createHash('sha1').update(`folder=${FOLDER}&timestamp=${timestamp}${apiSecret}`).digest('hex');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname || 'photo');
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('folder', FOLDER);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !body.secure_url) {
    throw new AppError(`Photo upload failed: ${body.error?.message ?? res.statusText}`, 502);
  }
  // Photos: serve a modern format at a sensible size (faster pages, less of the free allowance).
  return resourceType === 'image' ? body.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_limit,w_1600/') : body.secure_url;
}

/**
 * Stores a chat attachment. Cloudinary keeps audio under "video" and PDFs as
 * "raw" files (new accounts block PDF delivery from the image type).
 */
export async function storeChatFile(file: Express.Multer.File) {
  const kind: ResourceType = file.mimetype.startsWith('image/') ? 'image' : file.mimetype.startsWith('audio/') ? 'video' : 'raw';
  const url = usesCloudinary ? await uploadToCloudinary(file, kind) : `/uploads/${file.filename}`;
  return { url, name: file.originalname || 'file', mime: file.mimetype, size: file.size };
}

/** Stores uploaded photos and returns their public URLs, in the same order. */
export async function storeImages(files: Express.Multer.File[]): Promise<string[]> {
  if (!usesCloudinary) return files.map((f) => `/uploads/${f.filename}`);
  return Promise.all(files.map((f) => uploadToCloudinary(f, 'image')));
}
