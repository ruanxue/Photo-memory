import request from './request.js';

export const albumApi = {
  list: (params) => request.get('/albums', { params }),
  detail: (id) => request.get(`/albums/${id}`),
  create: (data) => request.post('/albums', data),
  update: (id, data) => request.put(`/albums/${id}`, data),
  remove: (id) => request.delete(`/albums/${id}`),
  sortPhotos: (id, data) => request.put(`/albums/${id}/sort-photos`, data),
  setCover: (id, data) => request.put(`/albums/${id}/cover`, data)
};
