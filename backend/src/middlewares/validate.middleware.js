import { validationResult } from 'express-validator';
import { fail } from '../utils/response.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, 422, '参数校验失败', errors.array());
  next();
};
