import path from 'path';
import sharp from 'sharp';
import { prisma } from '../config/prisma.js';
import { publicUploadUrl, uploadDirs } from '../utils/file.js';

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

export const processImage = async (file) => {
  const mediumName = buildDerivativeName(file.filename, 'medium');
  const thumbName = buildDerivativeName(file.filename, 'thumb');
  const mediumPath = path.join(uploadDirs.mediums, mediumName);
  const thumbPath = path.join(uploadDirs.thumbnails, thumbName);

  const source = sharp(file.path, { failOn: 'none' }).rotate();
  const metadata = await source.metadata();

  const shouldWatermark = await watermarkEnabled();
  const mediumPipeline = sharp(file.path, { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 });

  if (shouldWatermark) mediumPipeline.composite([watermarkOverlay(1600)]);
  await mediumPipeline.toFile(mediumPath);

  await sharp(file.path, { failOn: 'none' })
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
