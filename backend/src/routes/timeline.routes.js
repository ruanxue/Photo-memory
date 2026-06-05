import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { months, timeline, years } from '../controllers/timeline.controller.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(timeline));
router.get('/years', optionalAuth, asyncHandler(years));
router.get('/months', optionalAuth, asyncHandler(months));

export default router;
