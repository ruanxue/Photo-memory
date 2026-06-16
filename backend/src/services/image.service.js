import path from 'path';
import sharp from 'sharp';
import { prisma } from '../config/prisma.js';
import { publicUploadUrl, safeUnlinkUpload, uploadDirs } from '../utils/file.js';

const allowedFormats = new Set(['jpeg', 'png', 'webp']);
const maxImagePixels = 80_000_000;
const maxImageFrames = 1;

export const buildDerivativeName = (filename, suffix) => {
  const parsed = path.parse(filename);
  return `${parsed.name}-${suffix}.webp`;
};

const watermarkEnabled = async () => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'watermarkEnabled' } });
  return setting?.value === 'true';
};

const watermarkOverlay = (width = 1600) => ({
  input: Buffer.from(`
    <svg width="${width}" height="96" xmlns="http://www.w3.org/2000/svg">
      <text x="${width - 32}" y="54" text-anchor="end"
        font-family="Arial, sans-serif" font-size="28" font-weight="600"
        fill="rgba(255,255,255,0.72)">Photo Memory</text>
    </svg>
  `),
  gravity: 'southeast'
});

const assertSafeImageMetadata = (metadata) => {
  if (!allowedFormats.has(metadata.format)) {
    const err = new Error('仅支持真实的 jpg、png、webp 图片文件');
    err.status = 415;
    throw err;
  }
  const width = Number(metadata.width) || 0;
  const height = Number(metadata.height) || 0;
  if (!width || !height) {
    const err = new Error('无法读取图片尺寸，请检查图片文件');
    err.status = 422;
    throw err;
  }
  if (width * height > maxImagePixels) {
    const err = new Error('图片像素尺寸过大，请先压缩后再上传');
    err.status = 413;
    throw err;
  }
  if ((Number(metadata.pages) || 1) > maxImageFrames) {
    const err = new Error('暂不支持上传多帧或动图文件');
    err.status = 415;
    throw err;
  }
};

export const deleteImageArtifacts = async (file) => {
  if (!file?.filename) return;
  await Promise.all([
    safeUnlinkUpload(publicUploadUrl('originals', file.filename)),
    safeUnlinkUpload(publicUploadUrl('mediums', buildDerivativeName(file.filename, 'medium'))),
    safeUnlinkUpload(publicUploadUrl('thumbnails', buildDerivativeName(file.filename, 'thumb')))
  ]);
};

export const processImage = async (file) => {
  const mediumName = buildDerivativeName(file.filename, 'medium');
  const thumbName = buildDerivativeName(file.filename, 'thumb');
  const mediumPath = path.join(uploadDirs.mediums, mediumName);
  const thumbPath = path.join(uploadDirs.thumbnails, thumbName);

  const source = sharp(file.path, { failOn: 'error', limitInputPixels: maxImagePixels }).rotate();
  let metadata;
  try {
    metadata = await source.metadata();
  } catch (error) {
    const isPixelLimit = /pixel|limit/i.test(error?.message || '');
    const err = new Error(isPixelLimit ? '图片像素尺寸过大，请先压缩后再上传' : '文件不是有效的图片，或图片内容已经损坏');
    err.status = isPixelLimit ? 413 : 415;
    throw err;
  }
  assertSafeImageMetadata(metadata);

  const shouldWatermark = await watermarkEnabled();
  const mediumPipeline = sharp(file.path, { failOn: 'error', limitInputPixels: maxImagePixels })
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 });

  if (shouldWatermark) mediumPipeline.composite([watermarkOverlay(1600)]);
  await mediumPipeline.toFile(mediumPath);

  await sharp(file.path, { failOn: 'error', limitInputPixels: maxImagePixels })
    .rotate()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(thumbPath);

  return {
    width: metadata.width,
    height: metadata.height,
    originalUrl: publicUploadUrl('originals', file.filename),
    mediumUrl: publicUploadUrl('mediums', mediumName),
    thumbnailUrl: publicUploadUrl('thumbnails', thumbName)
  };
};
