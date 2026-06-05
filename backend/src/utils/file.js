import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(__dirname, '../..');
export const uploadRoot = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(backendRoot, 'uploads');

export const uploadDirs = {
  originals: path.join(uploadRoot, 'originals'),
  mediums: path.join(uploadRoot, 'mediums'),
  thumbnails: path.join(uploadRoot, 'thumbnails')
};

export const ensureUploadDirs = async () => {
  await Promise.all(Object.values(uploadDirs).map((dir) => fs.mkdir(dir, { recursive: true })));
};

export const publicUploadUrl = (type, filename) => `/uploads/${type}/${filename}`;

export const localPathFromUploadUrl = (url) => {
  if (!url || !url.startsWith('/uploads/')) return null;
  const normalized = path.normalize(url.replace(/^\/uploads\//, ''));
  if (normalized.includes('..')) return null;
  const fullPath = path.join(uploadRoot, normalized);
  if (!fullPath.startsWith(uploadRoot)) return null;
  return fullPath;
};

export const safeUnlinkUpload = async (url) => {
  const fullPath = localPathFromUploadUrl(url);
  if (!fullPath) return;
  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export const bytesToMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;
