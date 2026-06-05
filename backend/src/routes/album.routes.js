import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createAlbum, deleteAlbum, getAlbum, listAlbums, setAlbumCover, sortAlbumPhotos, updateAlbum } from '../controllers/album.controller.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(listAlbums));
router.get('/:id', optionalAuth, asyncHandler(getAlbum));
router.post('/', requireAuth, [body('title').notEmpty().withMessage('请输入相册标题'), validate], asyncHandler(createAlbum));
router.put('/:id', requireAuth, asyncHandler(updateAlbum));
router.delete('/:id', requireAuth, asyncHandler(deleteAlbum));
router.put('/:id/sort-photos', requireAuth, asyncHandler(sortAlbumPhotos));
router.put('/:id/cover', requireAuth, asyncHandler(setAlbumCover));

export default router;
