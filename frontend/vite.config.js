import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/element-plus') || id.includes('node_modules/@element-plus')) return 'vendor-element-plus';
          if (id.includes('node_modules/leaflet')) return 'vendor-map';
          if (id.includes('node_modules/gsap')) return 'vendor-animation';
          if (id.includes('/src/views/admin/AdminSettings.vue')) return 'admin-settings';
          if (id.includes('/src/components/map/') || id.includes('/src/views/map/')) return 'map';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:13033',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:13033',
        changeOrigin: true
      }
    }
  }
});
