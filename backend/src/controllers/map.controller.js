import { prisma } from '../config/prisma.js';
import { success } from '../utils/response.js';
import { photoInclude, visibilityFilter } from '../services/photo.service.js';
import { geocodeBaiduAddress, reverseGeocodeBaidu, searchBaiduPlaces } from '../services/baidu-geo.service.js';

const mapWhere = (req) => {
  const clauses = [visibilityFilter(req.user), { latitude: { not: null } }, { longitude: { not: null } }];
  if (req.query.q) clauses.push({ title: { contains: String(req.query.q).trim() } });
  if (req.query.city) clauses.push({ city: { contains: String(req.query.city) } });
  if (req.query.country) clauses.push({ country: { contains: String(req.query.country) } });
  if (req.query.year) {
    const year = Number(req.query.year);
    if (Number.isFinite(year)) clauses.push({ takenAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } });
  }
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
    where: { AND: [visibilityFilter(req.user), { country: { not: null } }, { latitude: { not: null } }, { longitude: { not: null } }] },
    select: { country: true }
  });
  const counts = photos.reduce((acc, photo) => {
    acc[photo.country] = (acc[photo.country] || 0) + 1;
    return acc;
  }, {});
  success(res, Object.entries(counts).map(([country, count]) => ({ country, count })));
};

export const mapYears = async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: { AND: [visibilityFilter(req.user), { latitude: { not: null } }, { longitude: { not: null } }] },
    select: { takenAt: true, uploadedAt: true }
  });
  const counts = photos.reduce((acc, photo) => {
    const date = photo.takenAt || photo.uploadedAt;
    if (!date) return acc;
    const year = date.getFullYear();
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
  const years = Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => b.year - a.year);
  success(res, years);
};

export const searchPlaces = async (req, res) => {
  const places = await searchBaiduPlaces(req.query);
  success(res, places);
};

export const geocodeAddress = async (req, res) => {
  const place = await geocodeBaiduAddress(req.query);
  success(res, place);
};

export const reverseGeocode = async (req, res) => {
  const place = await reverseGeocodeBaidu(req.query);
  success(res, place);
};
