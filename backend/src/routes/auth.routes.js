import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { loginLimiter, registerLimiter } from '../middlewares/rate-limit.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { changePassword, login, logout, profile, register, updateProfile } from '../controllers/auth.controller.js';

const router = Router();

const passwordRule = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('密码长度必须为 8-128 位');

router.post(
  '/register',
  registerLimiter,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 32 })
      .withMessage('用户名长度必须为 3-32 位')
      .matches(/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/)
      .withMessage('用户名只能包含中文、字母、数字、下划线和短横线'),
    body('email').trim().isEmail().withMessage('邮箱格式不正确').normalizeEmail(),
    passwordRule,
    body('confirmPassword').isLength({ min: 8, max: 128 }).withMessage('请确认密码'),
    validate
  ],
  asyncHandler(register)
);

router.post(
  '/login',
  loginLimiter,
  [
    body('account').trim().isLength({ min: 1, max: 160 }).withMessage('请输入用户名或邮箱'),
    body('password').isLength({ min: 1, max: 128 }).withMessage('请输入密码'),
    validate
  ],
  asyncHandler(login)
);

router.get('/profile', requireAuth, asyncHandler(profile));
router.put(
  '/profile',
  requireAuth,
  [
    body('email').optional().trim().isEmail().withMessage('邮箱格式不正确').normalizeEmail(),
    body('nickname').optional().trim().isLength({ max: 60 }).withMessage('昵称不能超过 60 位'),
    body('avatar').optional().trim().isLength({ max: 500 }).withMessage('头像地址过长'),
    body('bio').optional().trim().isLength({ max: 1000 }).withMessage('简介不能超过 1000 字'),
    validate
  ],
  asyncHandler(updateProfile)
);
router.put(
  '/password',
  requireAuth,
  [
    body('oldPassword').isLength({ min: 1, max: 128 }).withMessage('请输入原密码'),
    body('newPassword').isLength({ min: 8, max: 128 }).withMessage('新密码长度必须为 8-128 位'),
    body('confirmPassword').isLength({ min: 8, max: 128 }).withMessage('请确认新密码'),
    validate
  ],
  asyncHandler(changePassword)
);
router.post('/logout', requireAuth, asyncHandler(logout));

export default router;
