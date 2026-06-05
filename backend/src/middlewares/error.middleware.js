import { fail } from '../utils/response.js';

export const notFound = (req, res) => fail(res, 404, `接口不存在：${req.method} ${req.originalUrl}`);

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? '服务器内部错误' : err.message;
  if (status >= 500) console.error(err);
  return fail(res, status, message, err.details);
};
