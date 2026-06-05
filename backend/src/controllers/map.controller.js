import { prisma } from '../config/prisma.js';
import { success } from '../utils/response.js';
import { photoInclude, visibilityFilter } from '../services/photo.service.js';

const mapWhere = (req) => {
  const clauses = [visibilityFilter(req.user), { latitude: { not: null } }, { longitude: { not: null } }];
  if (req.query.city) clauses.push({ city: { contains: String(req.query.city) } });
  if (req.query.country) clauses.push({ country: { contains: String(req.query.country) } });
  if (req.query.year) clauses.push({ takenAt: { gte: new Date(Number(req.query.year), 0, 1), lt: new Date(Number(req.query.year) + 1, 0, 1) } });
  return { AND: clauses };
};

export const mapPhotos = async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: mapWhere(req),
    include: photoInclude,
    orderBy: [{ takenAt: 'desc' }, { uploadedAt: 'desc' }],
    take: 500
  });
  success(res, photos);
};

export const mapCities = async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: { AND: [visibilityFilter(req.user), { city: { not: null } }, { latitude: { not: null } }, { longitude: { not: null } }] },
    select: { city: true, country: true, latitude: true, longitude: true }
  });
  const grouped = new Map();
  photos.forEach((photo) => {
    const key = `${photo.country || ''}-${photo.city}`;
    const current = grouped.get(key) || { city: photo.city, country: photo.country, count: 0, latitude: photo.latitude, longitude: photo.longitude };
    current.count += 1;
    grouped.set(key, current);
  });
  success(res, [...grouped.values()].sort((a, b) => b.count - a.count));
};

export const mapCountries = async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: { AND: [visibilityFilter(req.user), { country: { not: null } }] },
    select: { country: true }
  });
  const counts = photos.reduce((acc, photo) => {
    acc[photo.country] = (acc[photo.country] || 0) + 1;
    return acc;
  }, {});
  success(res, Object.entries(counts).map(([country, count]) => ({ country, count })));
};
