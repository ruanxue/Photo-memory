import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { mapCities, mapCountries, mapPhotos, mapYears } from '../controllers/map.controller.js';

const router = Router();

router.get('/photos', optionalAuth, asyncHandler(mapPhotos));
router.get('/cities', optionalAuth, asyncHandler(mapCities));
router.get('/countries', optionalAuth, asyncHandler(mapCountries));
router.get('/years', optionalAuth, asyncHandler(mapYears));

export default router;
