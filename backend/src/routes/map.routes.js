import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { geoLimiter } from '../middlewares/rate-limit.middleware.js';
import {
  geocodeAddress,
  mapCities,
  mapCountries,
  mapFilterOptions,
  mapPhotos,
  mapYears,
  reverseGeocode,
  searchPlaces
} from '../controllers/map.controller.js';

const router = Router();

router.get('/photos', optionalAuth, asyncHandler(mapPhotos));
router.get('/cities', optionalAuth, asyncHandler(mapCities));
router.get('/countries', optionalAuth, asyncHandler(mapCountries));
router.get('/years', optionalAuth, asyncHandler(mapYears));
router.get('/filter-options', optionalAuth, asyncHandler(mapFilterOptions));
router.get('/places', requireAuth, geoLimiter, asyncHandler(searchPlaces));
router.get('/geocode', requireAuth, geoLimiter, asyncHandler(geocodeAddress));
router.get('/reverse-geocode', requireAuth, geoLimiter, asyncHandler(reverseGeocode));

export default router;
