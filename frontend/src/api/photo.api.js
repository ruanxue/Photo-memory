import request from './request.js';

export const photoApi = {
  list: (params) => request.get('/photos', { params }),
  detail: (id) => request.get(`/photos/${id}`),
  upload: (formData, onUploadProgress) => request.post('/photos/upload', formData, { onUploadProgress }),
  batchUpload: (formData, onUploadProgress) => request.post('/photos/batch-upload', formData, { onUploadProgress }),
  update: (id, data) => request.put(`/photos/${id}`, data),
  remove: (id) => request.delete(`/photos/${id}`),
  like: (id) => request.post(`/photos/${id}/like`),
  unlike: (id) => request.delete(`/photos/${id}/like`),
  favorite: (id) => request.post(`/photos/${id}/favorite`),
  unfavorite: (id) => request.delete(`/photos/${id}/favorite`),
  comments: (id) => request.get(`/photos/${id}/comments`),
  addComment: (id, data) => request.post(`/photos/${id}/comments`, data)
};
