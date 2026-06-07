import { defineStore } from 'pinia';
import { settingsApi } from '../api/settings.api.js';

const defaults = {
  siteName: 'Photo Memory',
  siteSubtitle: '私人影像馆',
  homeIntro: '记录旅行、生活与摄影作品。',
  themeMode: 'light',
  heroMode: 'random',
  heroPhotoIds: [],
  heroFixedPhotoId: null,
  allowRegister: true,
  allowUserUpload: true,
  commentsEnabled: true,
  commentReview: false,
  hideLoginEntry: false,
  watermarkEnabled: false,
  uploadMaxSizeMb: 15,
  pageSize: 24,
  waterfallColumns: 'auto',
  waterfallFullBleed: false,
  waterfallLoadAnimation: 'blur',
  waterfallLoadDurationMs: 720,
  waterfallLoadStaggerMs: 24,
  waterfallCustomLoadCss: '',
  trustProxyHops: 0,
  includeAlbumsInWaterfall: true,
  showExifOnHover: true,
  mapTileProvider: 'amap',
  mapTileUrl: '',
  mapTileAttribution: '© 高德地图',
  defaultSort: 'latest',
  faviconUrl: '',
  icp: '',
  footerCopyright: '© Photo Memory',
  technologyCredit: 'Vue 3 & Express + Prisma + SQLite'
};

const defaultFavicon =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2308090a%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2218%22 fill=%22none%22 stroke=%22%238fb8c4%22 stroke-width=%226%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%227%22 fill=%22%23d89575%22/%3E%3C/svg%3E';

const setFavicon = (href) => {
  const iconHref = href || defaultFavicon;
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = iconHref;
};

const themeModes = new Set(['light', 'dark', 'auto']);
let themeMediaQuery;
let themeMediaReady = false;
let latestThemeMode = defaults.themeMode;

const resolveTheme = (mode) => {
  const normalized = themeModes.has(mode) ? mode : defaults.themeMode;
  if (normalized === 'auto') {
    if (!themeMediaQuery && typeof window !== 'undefined') {
      themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }
    return themeMediaQuery?.matches ? 'dark' : 'light';
  }
  return normalized;
};

const applyThemeMode = (mode) => {
  if (typeof document === 'undefined') return;
  latestThemeMode = themeModes.has(mode) ? mode : defaults.themeMode;
  const resolved = resolveTheme(latestThemeMode);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.dataset.themeMode = latestThemeMode;
  root.dataset.resolvedTheme = resolved;
};

const ensureThemeMediaListener = () => {
  if (themeMediaReady || typeof window === 'undefined') return;
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (latestThemeMode === 'auto') applyThemeMode('auto');
  };
  if (typeof themeMediaQuery.addEventListener === 'function') themeMediaQuery.addEventListener('change', handleChange);
  else if (typeof themeMediaQuery.addListener === 'function') themeMediaQuery.addListener(handleChange);
  themeMediaReady = true;
};

const clearWaterfallLoadVars = () => {
  [
    '--waterfall-custom-load-opacity',
    '--waterfall-custom-load-filter',
    '--waterfall-custom-load-transform',
    '--waterfall-custom-load-easing'
  ].forEach((name) => document.documentElement.style.removeProperty(name));
};

const isUnsafeCssValue = (value) => /url\s*\(|@import|expression\s*\(|javascript:|<|>/i.test(value);

const applyCustomWaterfallLoadCss = (cssText = '') => {
  clearWaterfallLoadVars();
  const values = {};
  String(cssText)
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .forEach((rule) => {
      const separator = rule.indexOf(':');
      if (separator <= 0) return;
      const property = rule.slice(0, separator).trim().toLowerCase();
      const value = rule.slice(separator + 1).trim();
      if (!value || isUnsafeCssValue(value)) return;

      if (property === 'opacity') {
        const opacity = Number(value);
        if (Number.isFinite(opacity)) values.opacity = String(Math.max(0, Math.min(1, opacity)));
      } else if (property === 'filter' && value.length <= 160) {
        values.filter = value;
      } else if (property === 'transform' && value.length <= 180) {
        values.transform = value;
      } else if ((property === 'transition-timing-function' || property === 'animation-timing-function') && /^[a-z0-9.,()\s-]+$/i.test(value)) {
        values.easing = value.slice(0, 90);
      }
    });

  if (Object.prototype.hasOwnProperty.call(values, 'opacity')) document.documentElement.style.setProperty('--waterfall-custom-load-opacity', values.opacity);
  if (values.filter) document.documentElement.style.setProperty('--waterfall-custom-load-filter', values.filter);
  if (values.transform) document.documentElement.style.setProperty('--waterfall-custom-load-transform', values.transform);
  if (values.easing) document.documentElement.style.setProperty('--waterfall-custom-load-easing', values.easing);
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    loaded: false,
    settings: { ...defaults }
  }),
  getters: {
    siteName: (state) => state.settings.siteName || defaults.siteName,
    siteSubtitle: (state) => state.settings.siteSubtitle || defaults.siteSubtitle,
    homeIntro: (state) => state.settings.homeIntro || defaults.homeIntro
  },
  actions: {
    applyDocumentMeta() {
      document.title = `${this.siteName} · ${this.siteSubtitle}`;
      ensureThemeMediaListener();
      applyThemeMode(this.settings.themeMode);
      setFavicon(this.settings.faviconUrl);
      if (this.settings.waterfallLoadAnimation === 'custom') applyCustomWaterfallLoadCss(this.settings.waterfallCustomLoadCss);
      else clearWaterfallLoadVars();
    },
    async fetchPublicSettings() {
      const res = await settingsApi.public();
      this.settings = { ...defaults, ...(res.data || {}) };
      this.loaded = true;
      this.applyDocumentMeta();
      return this.settings;
    }
  }
});
