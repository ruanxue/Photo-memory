import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { changePassword, login, logout, profile, register, updateProfile } from '../controllers/auth.controller.js';

const router = Router();

router.post(
  '/register',
  [
    body('username').isLength({ min: 3, max: 32 }).withMessage('用户名长度为 3-32 位'),
    body('email').isEmail().withMessage('邮箱格式不正确'),
    body('password').isLength({ min: 8 }).withMessage('密码至少 8 位'),
    body('confirmPassword').notEmpty().withMessage('请确认密码'),
    validate
  ],
  asyncHandler(register)
);

router.post(
  '/login',
  [body('account').notEmpty().withMessage('请输入用户名或邮箱'), body('password').notEmpty().withMessage('请输入密码'), validate],
  asyncHandler(login)
);

router.get('/profile', requireAuth, asyncHandler(profile));
router.put('/profile', requireAuth, asyncHandler(updateProfile));
router.put(
  '/password',
  requireAuth,
  [
    body('oldPassword').notEmpty().withMessage('请输入原密码'),
    body('newPassword').isLength({ min: 8 }).withMessage('新密码至少 8 位'),
    body('confirmPassword').notEmpty().withMessage('请确认新密码'),
    validate
  ],
  asyncHandler(changePassword)
);
router.post('/logout', requireAuth, asyncHandler(logout));

export default router;
