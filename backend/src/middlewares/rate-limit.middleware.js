import rateLimit from 'express-rate-limit';
import { fail } from '../utils/response.js';
import { getClientIp } from '../utils/request.js';

const normalizeKeyPart = (value, fallback = 'unknown') =>
  String(value || fallback).trim().toLowerCase().replace(/\s+/g, '').slice(0, 180) || fallback;

const makeLimiter = ({ windowMs, limit, keyGenerator, message }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    const retryAfter = Number(req.rateLimit?.resetTime)
      ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(windowMs / 1000);
    res.set('Retry-After', String(retryAfter));
    return fail(res, 429, message, { retryAfter });
  }
});

export const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `${getClientIp(req) || 'unknown'}:${normalizeKeyPart(req.body?.account)}`,
  message: '登录尝试过于频繁，请稍后再试'
});

export const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  keyGenerator: (req) => getClientIp(req) || 'unknown',
  message: '注册请求过于频繁，请稍后再试'
});

export const uploadLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 80,
  keyGenerator: (req) => `${req.user?.id || 'guest'}:${getClientIp(req) || 'unknown'}`,
  message: '上传请求过于频繁，请稍后再试'
});

export const commentLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => {
    const ip = getClientIp(req) || 'unknown';
    const email = normalizeKeyPart(req.body?.guestEmail || req.user?.email);
    const device = normalizeKeyPart(req.headers['x-photo-device-id']);
    return `${ip}:${email}:${device}`;
  },
  message: '评论提交过于频繁，请稍后再试'
});

export const geoLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 80,
  keyGenerator: (req) => `${req.user?.id || 'guest'}:${getClientIp(req) || 'unknown'}`,
  message: '地理检索请求过于频繁，请稍后再试'
});
