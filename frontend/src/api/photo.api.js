import request from './request.js';

const uploadConfig = (onUploadProgress) => ({
  onUploadProgress,
  timeout: 180000
});

export const photoApi = {
  list: (params) => request.get('/photos', { params }),
  wall: (params) => request.get('/photos/wall', { params }),
  filterOptions: (params) => request.get('/photos/filter-options', { params }),
  detail: (id) => request.get(`/photos/${id}`),
  upload: (formData, onUploadProgress) => request.post('/photos/upload', formData, uploadConfig(onUploadProgress)),
  batchUpload: (formData, onUploadProgress) => request.post('/photos/batch-upload', formData, uploadConfig(onUploadProgress)),
  createFromUrl: (data) => request.post('/photos/url', data),
  update: (id, data) => request.put(`/photos/${id}`, data),
  remove: (id) => request.delete(`/photos/${id}`),
  favorite: (id) => request.post(`/photos/${id}/favorite`),
  unfavorite: (id) => request.delete(`/photos/${id}/favorite`),
  comments: (id) => request.get(`/photos/${id}/comments`),
  addComment: (id, data) => request.post(`/photos/${id}/comments`, data)
};
