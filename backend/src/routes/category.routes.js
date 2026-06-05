import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { getCategoryPhotos, listCategories } from '../controllers/category.controller.js';

const router = Router();

router.get('/', asyncHandler(listCategories));
router.get('/:id/photos', optionalAuth, asyncHandler(getCategoryPhotos));

export default router;
