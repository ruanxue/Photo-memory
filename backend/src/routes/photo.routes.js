import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  addComment,
  batchUploadPhotos,
  deletePhoto,
  favoritePhoto,
  getComments,
  getPhoto,
  listPhotos,
  unfavoritePhoto,
  updatePhoto,
  uploadPhoto
} from '../controllers/photo.controller.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(listPhotos));
router.get('/:id', optionalAuth, asyncHandler(getPhoto));
router.post('/upload', requireAuth, upload.single('photo'), asyncHandler(uploadPhoto));
router.post('/batch-upload', requireAuth, upload.array('photos', 30), asyncHandler(batchUploadPhotos));
router.put('/:id', requireAuth, asyncHandler(updatePhoto));
router.delete('/:id', requireAuth, asyncHandler(deletePhoto));
router.post('/:id/favorite', requireAuth, asyncHandler(favoritePhoto));
router.delete('/:id/favorite', requireAuth, asyncHandler(unfavoritePhoto));
router.get('/:id/comments', optionalAuth, asyncHandler(getComments));
router.post('/:id/comments', optionalAuth, asyncHandler(addComment));

export default router;
