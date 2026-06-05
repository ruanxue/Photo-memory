import request from './request.js';

export const tagApi = {
  list: () => request.get('/tags'),
  photos: (id, params) => request.get(`/tags/${id}/photos`, { params })
};
