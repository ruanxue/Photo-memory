import { defineStore } from 'pinia';
import { authApi } from '../api/auth.api.js';

const TOKEN_KEY = 'photo-memory-token';
const USER_KEY = 'photo-memory-user';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    sessionChecked: false
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token && state.user),
    isAdmin: (state) => state.user?.role === 'admin'
  },
  actions: {
    setSession(token, user) {
      this.token = token;
      this.user = user;
      this.sessionChecked = true;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clearSession() {
      this.token = null;
      this.user = null;
      this.sessionChecked = true;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    async bootstrap() {
      if (this.token) await this.ensureSession();
      else this.sessionChecked = true;
    },
    async ensureSession(force = false) {
      if (!this.token) {
        this.clearSession();
        return null;
      }
      if (!force && this.sessionChecked && this.user) return this.user;
      return this.fetchProfile();
    },
    async login(payload) {
      const res = await authApi.login(payload);
      this.setSession(res.data.token, res.data.user);
      return res;
    },
    async register(payload) {
      const res = await authApi.register(payload);
      this.setSession(res.data.token, res.data.user);
      return res;
    },
    async fetchProfile() {
      if (!this.token) return null;
      try {
        const res = await authApi.profile();
        this.user = res.data;
        this.sessionChecked = true;
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        return res.data;
      } catch {
        this.clearSession();
        return null;
      }
    },
    async updateProfile(payload) {
      const res = await authApi.updateProfile(payload);
      this.user = res.data;
      localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      return res;
    },
    async logout() {
      try {
        if (this.token) await authApi.logout();
      } finally {
        this.clearSession();
      }
    }
  }
});
