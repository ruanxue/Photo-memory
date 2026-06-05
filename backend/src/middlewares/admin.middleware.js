import { fail } from '../utils/response.js';

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return fail(res, 403, '需要管理员权限');
  next();
};
