import axios from 'axios';
import { ElMessage } from 'element-plus';

const request = axios.create({
  baseURL: '/api',
  timeout: 20000
});

const deviceStorageKey = 'photo-memory-device-id';

export const getDeviceId = () => {
  let deviceId = localStorage.getItem(deviceStorageKey);
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(deviceStorageKey, deviceId);
  }
  return deviceId;
};

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('photo-memory-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Photo-Device-Id'] = getDeviceId();
  return config;
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || '请求失败';
    if (status === 429) {
      window.dispatchEvent(new CustomEvent('photo-memory:rate-limit', {
        detail: {
          message,
          retryAfter: Number(error.response?.data?.details?.retryAfter || error.response?.headers?.['retry-after'] || 0)
        }
      }));
      return Promise.reject(error);
    }
    if (status === 401) {
      localStorage.removeItem('photo-memory-token');
      localStorage.removeItem('photo-memory-user');
    }
    if (status === 403) ElMessage.error(message || '没有权限');
    else if (status >= 500) ElMessage.error('服务器开小差了，请稍后再试');
    else if (message) ElMessage.error(message);
    return Promise.reject(error);
  }
);

export default request;
