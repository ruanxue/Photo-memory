import request from './request.js';

export const settingsApi = {
  public: () => request.get('/settings')
};
