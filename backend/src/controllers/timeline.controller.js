import { prisma } from '../config/prisma.js';
import { success } from '../utils/response.js';
import { photoInclude, visibilityFilter } from '../services/photo.service.js';

const groupTimeline = (photos) => {
  const years = new Map();
  photos.forEach((photo) => {
    const date = photo.takenAt || photo.uploadedAt || photo.createdAt;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, new Map());
    const days = months.get(month);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(photo);
  });
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, days]) => ({
          month,
          days: [...days.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([day, photos]) => ({
              day,
              title: photos[0].city || photos[0].album?.title || '影像记录',
              description: photos[0].locationName || photos[0].description,
              city: photos[0].city,
              count: photos.length,
              photos
            }))
        }))
    }));
};

const timelineWhere = (req) => {
  const clauses = [visibilityFilter(req.user)];
  if (req.query.city) clauses.push({ city: { contains: String(req.query.city) } });
  if (req.query.albumId) clauses.push({ albumId: Number(req.query.albumId) });
  if (req.query.categoryId) clauses.push({ categoryId: Number(req.query.categoryId) });
  return { AND: clauses };
};

export const timeline = async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: timelineWhere(req),
    include: photoInclude,
    orderBy: [{ takenAt: 'desc' }, { uploadedAt: 'desc' }]
  });
  success(res, groupTimeline(photos));
};

export const years = async (req, res) => {
  const photos = await prisma.photo.findMany({ where: visibilityFilter(req.user), select: { takenAt: true, uploadedAt: true } });
  const data = [...new Set(photos.map((photo) => (photo.takenAt || photo.uploadedAt).getFullYear()))].sort((a, b) => b - a);
  success(res, data);
};

export const months = async (req, res) => {
  const photos = await prisma.photo.findMany({ where: visibilityFilter(req.user), select: { takenAt: true, uploadedAt: true } });
  const data = [...new Set(photos.map((photo) => {
    const date = photo.takenAt || photo.uploadedAt;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }))].sort().reverse();
  success(res, data);
};
