import { prisma } from '../config/prisma.js';
import { deleteImageArtifacts, processImage } from './image.service.js';
import { readExif } from './exif.service.js';

export const processUploadedFile = async (file, userId) => {
  try {
    const [imageInfo, exifInfo] = await Promise.all([processImage(file), readExif(file.path)]);
    await prisma.uploadLog.create({
      data: {
        userId,
        filename: file.originalname,
        fileSize: file.size,
        status: 'success',
        message: 'uploaded'
      }
    });
    return { imageInfo, exifInfo };
  } catch (error) {
    await deleteImageArtifacts(file);
    await prisma.uploadLog.create({
      data: {
        userId,
        filename: file.originalname,
        fileSize: file.size,
        status: 'failed',
        message: error.message
      }
    });
    throw error;
  }
};
