import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { search } from '../controllers/search.controller.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(search));

export default router;
