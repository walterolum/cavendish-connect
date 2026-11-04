import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { BadRequestError } from '../utils/errors';
import { usesCloudinary } from '../utils/storage';

// Extension comes from the checked image type, never from the uploaded file name,
// so a file can't be stored as .html/.svg/.js and then served from our origin.
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// With Cloudinary, files stay in memory until they are sent there; otherwise they go to disk.
if (!usesCloudinary) fs.mkdirSync(config.storage.path, { recursive: true });

const storage = usesCloudinary ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.path);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${EXTENSIONS[file.mimetype]}`);
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (EXTENSIONS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.storage.maxSize,
    files: 10,
  },
});

export const uploadMultiple = upload.array('images', 10);

// Chat attachments: photos, voice notes and PDF documents.
const CHAT_EXTENSIONS: Record<string, string> = {
  ...EXTENSIONS,
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'application/pdf': '.pdf',
};
const CHAT_MAX = 10 * 1024 * 1024;

export const chatUpload = multer({
  storage: usesCloudinary
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, config.storage.path),
        // Recorders send e.g. "audio/webm;codecs=opus"; the extension comes from the base type.
        filename: (_req, file, cb) => cb(null, `${uuidv4()}${CHAT_EXTENSIONS[file.mimetype.split(';')[0]]}`),
      }),
  fileFilter: (_req, file, cb) => {
    file.mimetype = file.mimetype.split(';')[0].trim().toLowerCase();
    if (CHAT_EXTENSIONS[file.mimetype]) cb(null, true);
    else cb(new BadRequestError('You can send photos, voice notes and PDF documents'));
  },
  limits: { fileSize: CHAT_MAX, files: 1 },
}).single('file');
export const uploadSingle = upload.single('image');
