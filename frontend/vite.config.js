import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

const allowedHosts = [
  'demo.173015.xyz',
  ...(process.env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
];

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: 'css' })]
    }),
    Components({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: 'css' })]
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@element-plus/icons-vue')) return 'vendor-element-plus-icons';
          if (id.includes('node_modules/@element-plus') || id.includes('node_modules/element-plus')) {
            const componentMatch = id.match(/node_modules\/element-plus\/es\/components\/([^/]+)/);
            const component = componentMatch?.[1];
            if (['form', 'form-item', 'input', 'input-number', 'select', 'option', 'option-group', 'checkbox', 'radio', 'radio-group', 'upload', 'date-picker', 'color-picker', 'slider'].includes(component)) {
              return 'vendor-element-plus-form';
            }
            if (['dialog', 'drawer', 'message', 'message-box', 'popper', 'tooltip', 'popover', 'overlay', 'loading'].includes(component)) {
              return 'vendor-element-plus-overlay';
            }
            if (['table', 'table-column', 'pagination', 'tabs', 'tab-pane', 'collapse', 'collapse-item'].includes(component)) {
              return 'vendor-element-plus-data';
            }
            if (component) return 'vendor-element-plus-basic';
            return 'vendor-element-plus-core';
          }
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
    allowedHosts,
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
