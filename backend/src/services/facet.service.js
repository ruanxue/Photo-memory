import { prisma } from '../config/prisma.js';
import { visibilityFilter } from './photo.service.js';

const toBool = (value) => value === true || value === 'true' || value === '1';

const parseIds = (value) => {
  if (!value) return [];
  return [...new Set(String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0))]
    .slice(0, 200);
};

const hasFilter = (omit, key) => !omit.includes(key);

export const buildFacetPhotoWhere = (req, { gpsOnly = false, omit = [] } = {}) => {
  const q = String(req.query.q || '').trim();
  const clauses = [visibilityFilter(req.user)];
  const { albumId, categoryId, tagId, year, month, city, country, pinned, featured, ids } = req.query;

  if (q && hasFilter(omit, 'q')) {
    clauses.push({
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { city: { contains: q } },
        { country: { contains: q } },
        { locationName: { contains: q } },
        { cameraMake: { contains: q } },
        { cameraModel: { contains: q } }
      ]
    });
  }

  if (albumId && hasFilter(omit, 'albumId')) clauses.push({ albumId: Number(albumId) });
  if (categoryId && hasFilter(omit, 'categoryId')) clauses.push({ categoryId: Number(categoryId) });
  if (tagId && hasFilter(omit, 'tagId')) clauses.push({ tags: { some: { tagId: Number(tagId) } } });
  if (ids && hasFilter(omit, 'ids')) {
    const idList = parseIds(ids);
    clauses.push(idList.length ? { id: { in: idList } } : { id: -1 });
  }
  if (country && hasFilter(omit, 'country')) clauses.push({ country: { contains: String(country) } });
  if (city && hasFilter(omit, 'city')) clauses.push({ city: { contains: String(city) } });
  if (pinned === 'true' && hasFilter(omit, 'pinned')) clauses.push({ isPinned: true });
  if (featured === 'true' && hasFilter(omit, 'featured')) clauses.push({ isFeatured: true });
  if (year && hasFilter(omit, 'year')) {
    const startMonth = month ? Number(month) - 1 : 0;
    const endMonth = month ? Number(month) : 12;
    const gte = new Date(Number(year), startMonth, 1);
    const lt = new Date(Number(year), endMonth, 1);
    clauses.push({
      OR: [
        { takenAt: { gte, lt } },
        { AND: [{ takenAt: null }, { uploadedAt: { gte, lt } }] }
      ]
    });
  }
  if (gpsOnly) clauses.push({ latitude: { not: null } }, { longitude: { not: null } });

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
};

const aggregateCountries = (photos) => {
  const counts = photos.reduce((acc, photo) => {
    const country = String(photo.country || '').trim();
    if (!country) return acc;
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'zh-Hans-CN'));
};

const aggregateCities = (photos) => {
  const grouped = new Map();
  photos.forEach((photo) => {
    const city = String(photo.city || '').trim();
    if (!city) return;
    const country = String(photo.country || '').trim();
    const key = `${country}::${city}`;
    const current = grouped.get(key) || { city, country, count: 0, latitude: photo.latitude, longitude: photo.longitude };
    current.count += 1;
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'zh-Hans-CN'));
};

const aggregateYears = (photos) => {
  const counts = photos.reduce((acc, photo) => {
    const date = photo.takenAt || photo.uploadedAt;
    if (!date) return acc;
    const year = date.getFullYear();
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => b.year - a.year);
};

export const photoFilterFacets = async (req, { gpsOnly = false } = {}) => {
  const [countryPhotos, cityPhotos, datePhotos] = await Promise.all([
    prisma.photo.findMany({
      where: buildFacetPhotoWhere(req, { gpsOnly, omit: ['country', 'city', 'year'] }),
      select: { country: true }
    }),
    prisma.photo.findMany({
      where: buildFacetPhotoWhere(req, { gpsOnly, omit: ['city', 'year'] }),
      select: { city: true, country: true, latitude: true, longitude: true }
    }),
    prisma.photo.findMany({
      where: buildFacetPhotoWhere(req, { gpsOnly, omit: ['year'] }),
      select: { takenAt: true, uploadedAt: true }
    })
  ]);

  return {
    countries: aggregateCountries(countryPhotos),
    cities: aggregateCities(cityPhotos),
    years: aggregateYears(datePhotos)
  };
};

export const normalizeFacetBoolean = toBool;
