import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env.js';
import { uploadDirs } from '../utils/file.js';

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirs.originals),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedMime.has(file.mimetype) || !allowedExt.has(ext)) {
    cb(new Error('仅支持 jpg、jpeg、png、webp 图片'));
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.uploadMaxSizeMb * 1024 * 1024 }
});
