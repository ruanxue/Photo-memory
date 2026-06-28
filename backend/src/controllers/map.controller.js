import { prisma } from '../config/prisma.js';
import { success } from '../utils/response.js';
import { photoInclude, visibilityFilter } from '../services/photo.service.js';
import { geocodeBaiduAddress, reverseGeocodeBaidu, searchBaiduPlaces } from '../services/baidu-geo.service.js';
import { photoFilterFacets } from '../services/facet.service.js';

const mapWhere = (req) => {
  const clauses = [
    visibilityFilter(req.user),
    { OR: [{ externalStatus: null }, { externalStatus: { not: 'failed' } }] },
    { latitude: { not: null } },
    { longitude: { not: null } }
  ];
  if (req.query.q) clauses.push({ title: { contains: String(req.query.q).trim() } });
  if (req.query.city) clauses.push({ city: { contains: String(req.query.city) } });
  if (req.query.country) clauses.push({ country: { contains: String(req.query.country) } });
  if (req.query.year) {
    const year = Number(req.query.year);
    if (Number.isFinite(year)) {
      const gte = new Date(year, 0, 1);
      const lt = new Date(year + 1, 0, 1);
      clauses.push({
        OR: [
          { takenAt: { gte, lt } },
          { AND: [{ takenAt: null }, { uploadedAt: { gte, lt } }] }
        ]
      });
    }
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
  const facets = await photoFilterFacets(req, { gpsOnly: true });
  success(res, facets.cities);
};

export const mapCountries = async (req, res) => {
  const facets = await photoFilterFacets(req, { gpsOnly: true });
  success(res, facets.countries);
};

export const mapYears = async (req, res) => {
  const facets = await photoFilterFacets(req, { gpsOnly: true });
  success(res, facets.years);
};

export const mapFilterOptions = async (req, res) => {
  success(res, await photoFilterFacets(req, { gpsOnly: true }));
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
