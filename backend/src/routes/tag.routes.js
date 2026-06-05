import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { getTagPhotos, listTags } from '../controllers/tag.controller.js';

const router = Router();

router.get('/', asyncHandler(listTags));
router.get('/:id/photos', optionalAuth, asyncHandler(getTagPhotos));

export default router;
