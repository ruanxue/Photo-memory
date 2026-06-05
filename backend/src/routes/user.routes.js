import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { myAlbums, myComments, myFavorites, myPhotos, myStatistics } from '../controllers/user.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/photos', asyncHandler(myPhotos));
router.get('/albums', asyncHandler(myAlbums));
router.get('/favorites', asyncHandler(myFavorites));
router.get('/comments', asyncHandler(myComments));
router.get('/statistics', asyncHandler(myStatistics));

export default router;
