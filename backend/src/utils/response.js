export const success = (res, data = null, message = 'ok', meta = undefined) => {
  res.json({ success: true, message, data, ...(meta ? { meta } : {}) });
};

export const created = (res, data = null, message = 'created') => {
  res.status(201).json({ success: true, message, data });
};

export const fail = (res, status = 400, message = 'request failed', details = undefined) => {
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
};
