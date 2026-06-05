import { prisma } from '../config/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import { fail } from '../utils/response.js';

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
};

export const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (user && user.status === 'active') req.user = user;
  } catch {
    req.user = null;
  }
  next();
};

export const requireAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return fail(res, 401, '请先登录');
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return fail(res, 401, '用户不存在');
    if (user.status !== 'active') return fail(res, 403, '账号已被禁用');
    req.user = user;
    next();
  } catch {
    return fail(res, 401, '登录状态已过期，请重新登录');
  }
};
