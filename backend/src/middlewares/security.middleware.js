import { fail } from '../utils/response.js';

const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
const maxDepth = 10;
const maxObjectKeys = 600;
const maxStringLength = 20000;

const inspectPayload = (value, depth = 0, seen = new WeakSet()) => {
  if (depth > maxDepth) return '请求体层级过深';
  if (typeof value === 'string') {
    if (value.includes('\0')) return '请求参数包含非法控制字符';
    if (value.length > maxStringLength) return '请求参数过长';
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > maxObjectKeys) return '请求数组过长';
    for (const item of value) {
      const error = inspectPayload(item, depth + 1, seen);
      if (error) return error;
    }
    return null;
  }

  const keys = Object.keys(value);
  if (keys.length > maxObjectKeys) return '请求字段过多';
  for (const key of keys) {
    const normalizedKey = String(key).toLowerCase();
    if (dangerousKeys.has(normalizedKey) || normalizedKey.startsWith('$')) {
      return '请求参数包含不允许的字段';
    }
    const error = inspectPayload(value[key], depth + 1, seen);
    if (error) return error;
  }
  return null;
};

export const guardRequestPayload = (req, res, next) => {
  const error = inspectPayload({ body: req.body, query: req.query, params: req.params });
  if (error) return fail(res, 400, error);
  return next();
};
