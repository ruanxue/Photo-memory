import { defineStore } from 'pinia';
import request from '../api/request.js';

export const useUserStore = defineStore('user', {
  state: () => ({ statistics: null }),
  actions: {
    async fetchStatistics() {
      const res = await request.get('/my/statistics');
      this.statistics = res.data;
      return res.data;
    }
  }
});
