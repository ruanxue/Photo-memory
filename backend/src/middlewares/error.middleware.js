import { fail } from '../utils/response.js';

export const notFound = (req, res) => fail(res, 404, `接口不存在：${req.method} ${req.originalUrl}`);

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? '上传图片过大，请检查后台上传限制和反向代理 client_max_body_size'
      : '上传参数不正确，请重新选择图片';
    return fail(res, status, message);
  }
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? '服务器内部错误' : err.message;
  if (status >= 500) console.error(err);
  return fail(res, status, message, err.details);
};
