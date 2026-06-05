import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicSettings } from '../controllers/setting.controller.js';

const router = Router();

router.get('/', asyncHandler(publicSettings));

export default router;
