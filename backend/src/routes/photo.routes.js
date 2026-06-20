import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { commentLimiter, uploadLimiter } from '../middlewares/rate-limit.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  addComment,
  batchUploadPhotos,
  createPhotoFromUrl,
  deletePhoto,
  favoritePhoto,
  getComments,
  getPhoto,
  listPhotos,
  listWallPhotos,
  photoFilterOptions,
  unfavoritePhoto,
  updatePhoto,
  uploadPhoto
} from '../controllers/photo.controller.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(listPhotos));
router.get('/wall', optionalAuth, asyncHandler(listWallPhotos));
router.get('/filter-options', optionalAuth, asyncHandler(photoFilterOptions));
router.post('/upload', requireAuth, uploadLimiter, upload.single('photo'), asyncHandler(uploadPhoto));
router.post('/batch-upload', requireAuth, uploadLimiter, upload.array('photos', 30), asyncHandler(batchUploadPhotos));
router.post('/url', requireAuth, uploadLimiter, asyncHandler(createPhotoFromUrl));
router.get('/:id', optionalAuth, asyncHandler(getPhoto));
router.put('/:id', requireAuth, asyncHandler(updatePhoto));
router.delete('/:id', requireAuth, asyncHandler(deletePhoto));
router.post('/:id/favorite', requireAuth, asyncHandler(favoritePhoto));
router.delete('/:id/favorite', requireAuth, asyncHandler(unfavoritePhoto));
router.get('/:id/comments', optionalAuth, asyncHandler(getComments));
router.post('/:id/comments', optionalAuth, commentLimiter, asyncHandler(addComment));

export default router;
