import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  batchPhotos,
  createAlbum,
  createCategory,
  createTag,
  createUser,
  deleteAlbum,
  deleteCategory,
  deleteComment,
  deletePhoto,
  deleteTag,
  deleteUser,
  featurePhoto,
  getSettings,
  listAlbums,
  listCategories,
  listComments,
  listPhotos,
  listTags,
  listUsers,
  mergeTags,
  resetUserPassword,
  statistics,
  updateAlbum,
  updateCategory,
  updateCommentStatus,
  updatePhoto,
  updateSettings,
  updateTag,
  updateUser,
  updateUserRole,
  updateUserStatus,
  visibilityPhoto
} from '../controllers/admin.controller.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/statistics', asyncHandler(statistics));

router.get('/users', asyncHandler(listUsers));
router.post('/users', [body('username').notEmpty(), body('email').isEmail(), validate], asyncHandler(createUser));
router.put('/users/:id', asyncHandler(updateUser));
router.delete('/users/:id', asyncHandler(deleteUser));
router.put('/users/:id/status', asyncHandler(updateUserStatus));
router.put('/users/:id/role', asyncHandler(updateUserRole));
router.put('/users/:id/password', asyncHandler(resetUserPassword));

router.get('/photos', asyncHandler(listPhotos));
router.put('/photos/batch', asyncHandler(batchPhotos));
router.put('/photos/:id', asyncHandler(updatePhoto));
router.delete('/photos/:id', asyncHandler(deletePhoto));
router.put('/photos/:id/feature', asyncHandler(featurePhoto));
router.put('/photos/:id/visibility', asyncHandler(visibilityPhoto));

router.get('/albums', asyncHandler(listAlbums));
router.post('/albums', [body('title').notEmpty(), validate], asyncHandler(createAlbum));
router.put('/albums/:id', asyncHandler(updateAlbum));
router.delete('/albums/:id', asyncHandler(deleteAlbum));

router.get('/categories', asyncHandler(listCategories));
router.post('/categories', [body('name').notEmpty(), validate], asyncHandler(createCategory));
router.put('/categories/:id', asyncHandler(updateCategory));
router.delete('/categories/:id', asyncHandler(deleteCategory));

router.get('/tags', asyncHandler(listTags));
router.post('/tags', [body('name').notEmpty(), validate], asyncHandler(createTag));
router.put('/tags/:id', asyncHandler(updateTag));
router.delete('/tags/:id', asyncHandler(deleteTag));
router.post('/tags/merge', asyncHandler(mergeTags));

router.get('/comments', asyncHandler(listComments));
router.put('/comments/:id/status', asyncHandler(updateCommentStatus));
router.delete('/comments/:id', asyncHandler(deleteComment));

router.get('/settings', asyncHandler(getSettings));
router.put('/settings', asyncHandler(updateSettings));

export default router;
