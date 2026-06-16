import { defineStore } from 'pinia';
import { settingsApi } from '../api/settings.api.js';

export const defaultCustomThemeColors = {
  primary: '#8d7155',
  accent: '#b66f54',
  pageBg: '#f6f1e9',
  surface: '#ffffff',
  surfaceSoft: '#f0ebe3',
  surfaceOverlay: '#fffaf3',
  text: '#172026',
  textSoft: '#334047',
  muted: '#56636c',
  line: '#d5c9bc',
  buttonBg: '#f3eee6',
  buttonText: '#27343b',
  buttonHoverBg: '#eadccd',
  tagBg: '#ece2d3',
  tagText: '#3f3328',
  mapControlBg: '#fffaf3',
  mapControlText: '#172026',
  mapPopupBg: '#fffaf3',
  mapPopupText: '#172026',
  dockActiveBg: '#3f3328',
  dockActiveText: '#ffffff',
  imageOverlayBg: '#241f19',
  imageOverlayText: '#fffaf3'
};

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
  waterfallCardRadius: 4,
  waterfallRevealAnimation: 'slide-up',
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
  themeCustomEnabled: false,
  themeCustomName: '',
  themeCustomEditorMode: 'simple',
  themeCustomColors: { ...defaultCustomThemeColors },
  savedThemes: [],
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

const colorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const normalizeHexColor = (value) => {
  const color = String(value || '').trim();
  if (!colorPattern.test(color)) return '';
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return color.toLowerCase();
};

const hexToRgb = (hex) => {
  const color = normalizeHexColor(hex).slice(1);
  if (!color) return null;
  return {
    r: Number.parseInt(color.slice(0, 2), 16),
    g: Number.parseInt(color.slice(2, 4), 16),
    b: Number.parseInt(color.slice(4, 6), 16)
  };
};

const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
};

const readableOn = (background) => {
  const bg = normalizeHexColor(background);
  if (!bg) return '#ffffff';
  const whiteContrast = (1.05) / (relativeLuminance(bg) + 0.05);
  const blackContrast = (relativeLuminance(bg) + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? '#ffffff' : '#071012';
};

const customThemeVars = `
  --theme-accent --theme-admin-side-bg --theme-admin-side-hover --theme-admin-side-muted --theme-admin-side-text
  --theme-body-radial --theme-button-bg --theme-button-border --theme-button-disabled-bg --theme-button-disabled-border
  --theme-button-disabled-text --theme-button-hover-bg --theme-button-hover-border --theme-button-text
  --theme-control-selected-bg --theme-control-selected-border --theme-control-selected-text
  --theme-danger --theme-danger-bg --theme-danger-border --theme-danger-text
  --theme-dock-active-bg --theme-dock-active-text --theme-dock-bg --theme-dock-border --theme-dock-text
  --theme-dock-tooltip-bg --theme-dock-tooltip-text
  --theme-hero-control-bg --theme-hero-control-border --theme-hero-control-text --theme-hero-kicker
  --theme-hero-muted --theme-hero-shade-bg --theme-hero-subtle --theme-hero-text
  --theme-image-hover-bottom-shadow --theme-image-hover-ring --theme-image-hover-scrim --theme-image-hover-top-shadow
  --theme-image-overlay-bg --theme-image-overlay-bg-strong --theme-image-overlay-border --theme-image-overlay-border-strong
  --theme-image-overlay-chip-bg --theme-image-overlay-chip-bg-strong --theme-image-overlay-muted --theme-image-overlay-shadow
  --theme-image-overlay-text --theme-image-skeleton-base --theme-image-skeleton-sheen
  --theme-input-bg --theme-input-border
  --theme-lightbox-bg --theme-lightbox-control-bg --theme-lightbox-control-border --theme-lightbox-muted
  --theme-lightbox-shadow --theme-lightbox-text
  --theme-line --theme-line-faint --theme-line-soft --theme-loading-mask
  --theme-map-control-bg --theme-map-control-border --theme-map-control-hover-bg --theme-map-control-hover-text
  --theme-map-control-text --theme-map-marker-fill --theme-map-marker-ring --theme-map-marker-shadow
  --theme-map-popup-bg --theme-map-popup-border --theme-map-popup-muted --theme-map-popup-shadow --theme-map-popup-text
  --theme-map-tile-filter --theme-muted --theme-muted-strong --theme-overlay-bg
  --theme-page-bg --theme-page-bg-bottom --theme-page-bg-top --theme-placeholder
  --theme-primary --theme-primary-soft --theme-primary-strong --theme-primary-text
  --theme-rate-limit-backdrop-a --theme-rate-limit-backdrop-b --theme-rate-limit-backdrop-c --theme-rate-limit-card-bg
  --theme-rate-limit-mark --theme-shadow --theme-skeleton-a --theme-skeleton-b
  --theme-success --theme-surface --theme-surface-glass --theme-surface-overlay --theme-surface-soft --theme-surface-strong
  --theme-switch-off-bg --theme-switch-off-border --theme-switch-off-knob --theme-switch-on-bg --theme-switch-on-border
  --theme-switch-on-knob --theme-switch-shadow --theme-table-header-bg --theme-table-hover-bg
  --theme-tag-bg --theme-tag-border --theme-tag-fallback --theme-tag-gradient-bg --theme-tag-text
  --theme-text --theme-text-soft --theme-wall-card-bg --theme-wall-card-body-bg --theme-wall-card-muted
  --theme-wall-card-text --theme-wall-page-bg --theme-warning
`.trim().split(/\s+/);

const clearCustomThemeVars = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  customThemeVars.forEach((name) => root.style.removeProperty(name));
  root.style.colorScheme = '';
  delete root.dataset.customTheme;
};

const normalizeCustomThemeColors = (colors = {}) => {
  const merged = { ...defaultCustomThemeColors, ...(colors || {}) };
  return Object.fromEntries(
    Object.entries(defaultCustomThemeColors).map(([key, fallback]) => [key, normalizeHexColor(merged[key]) || fallback])
  );
};

const setThemeVar = (root, name, value) => {
  if (value) root.style.setProperty(name, value);
};

const mix = (color, percent, base = 'transparent') => `color-mix(in srgb, ${color} ${percent}%, ${base})`;

const applyCustomThemeColors = (settings = {}) => {
  clearCustomThemeVars();
  if (!settings.themeCustomEnabled || typeof document === 'undefined') return;
  const colors = normalizeCustomThemeColors(settings.themeCustomColors);
  const root = document.documentElement;
  const darkTheme = relativeLuminance(colors.pageBg) < 0.42;
  const primaryText = readableOn(colors.primary);
  const dockText = normalizeHexColor(colors.dockActiveText) || readableOn(colors.dockActiveBg);
  const overlayText = normalizeHexColor(colors.imageOverlayText) || readableOn(colors.imageOverlayBg);
  const primaryStrong = mix(colors.primary, 62, colors.text);
  const surfaceStrong = mix(colors.surfaceSoft, 74, colors.text);
  const danger = mix(colors.accent, 42, '#c84d4d');
  const warning = mix(colors.accent, 64, '#d2a23a');
  const shadow = `0 22px 70px ${mix(colors.primary, darkTheme ? 20 : 16)}`;
  const imageOverlay = mix(colors.imageOverlayBg, 74);
  const imageOverlayStrong = mix(colors.imageOverlayBg, 88);
  const lightboxBg = mix(colors.imageOverlayBg, 94, '#000000');
  const lightboxText = overlayText;

  root.dataset.customTheme = 'enabled';
  root.style.colorScheme = darkTheme ? 'dark' : 'light';
  setThemeVar(root, '--theme-primary', colors.primary);
  setThemeVar(root, '--theme-primary-strong', primaryStrong);
  setThemeVar(root, '--theme-primary-soft', mix(colors.primary, 16));
  setThemeVar(root, '--theme-primary-text', primaryText);
  setThemeVar(root, '--theme-accent', colors.accent);
  setThemeVar(root, '--theme-success', colors.primary);
  setThemeVar(root, '--theme-warning', warning);
  setThemeVar(root, '--theme-danger', danger);
  setThemeVar(root, '--theme-shadow', shadow);
  setThemeVar(root, '--theme-page-bg', colors.pageBg);
  setThemeVar(root, '--theme-page-bg-top', mix(colors.surfaceOverlay, 72, colors.pageBg));
  setThemeVar(root, '--theme-page-bg-bottom', mix(colors.surfaceSoft, 68, colors.pageBg));
  setThemeVar(root, '--theme-body-radial', mix(colors.primary, 12));
  setThemeVar(root, '--theme-surface', colors.surface);
  setThemeVar(root, '--theme-surface-soft', colors.surfaceSoft);
  setThemeVar(root, '--theme-surface-strong', surfaceStrong);
  setThemeVar(root, '--theme-surface-overlay', colors.surfaceOverlay);
  setThemeVar(root, '--theme-surface-glass', mix(colors.surface, 88));
  setThemeVar(root, '--theme-text', colors.text);
  setThemeVar(root, '--theme-text-soft', colors.textSoft);
  setThemeVar(root, '--theme-muted', colors.muted);
  setThemeVar(root, '--theme-muted-strong', mix(colors.muted, 74, colors.text));
  setThemeVar(root, '--theme-line', colors.line);
  setThemeVar(root, '--theme-line-soft', mix(colors.line, 72));
  setThemeVar(root, '--theme-line-faint', mix(colors.line, 38));
  setThemeVar(root, '--theme-overlay-bg', mix(colors.text, darkTheme ? 62 : 42));
  setThemeVar(root, '--theme-loading-mask', mix(colors.pageBg, 72));
  setThemeVar(root, '--theme-skeleton-a', mix(colors.surfaceSoft, 84, colors.primary));
  setThemeVar(root, '--theme-skeleton-b', mix(colors.surface, 86, colors.primary));
  setThemeVar(root, '--theme-input-bg', mix(colors.surface, 78));
  setThemeVar(root, '--theme-input-border', colors.line);
  setThemeVar(root, '--theme-placeholder', mix(colors.muted, 72, colors.surface));
  setThemeVar(root, '--theme-button-bg', colors.buttonBg);
  setThemeVar(root, '--theme-button-border', colors.line);
  setThemeVar(root, '--theme-button-text', colors.buttonText);
  setThemeVar(root, '--theme-button-hover-bg', colors.buttonHoverBg);
  setThemeVar(root, '--theme-button-hover-border', colors.primary);
  setThemeVar(root, '--theme-button-disabled-bg', mix(colors.buttonBg, 70, colors.surface));
  setThemeVar(root, '--theme-button-disabled-border', mix(colors.line, 62));
  setThemeVar(root, '--theme-button-disabled-text', mix(colors.buttonText, 48, colors.muted));
  setThemeVar(root, '--theme-control-selected-bg', colors.primary);
  setThemeVar(root, '--theme-control-selected-border', colors.primary);
  setThemeVar(root, '--theme-control-selected-text', primaryText);
  setThemeVar(root, '--theme-switch-off-bg', surfaceStrong);
  setThemeVar(root, '--theme-switch-off-border', colors.line);
  setThemeVar(root, '--theme-switch-off-knob', colors.surfaceOverlay);
  setThemeVar(root, '--theme-switch-on-bg', colors.primary);
  setThemeVar(root, '--theme-switch-on-border', colors.primary);
  setThemeVar(root, '--theme-switch-on-knob', primaryText);
  setThemeVar(root, '--theme-switch-shadow', `0 8px 18px ${mix(colors.text, darkTheme ? 30 : 12)}`);
  setThemeVar(root, '--theme-danger-bg', mix(danger, 14));
  setThemeVar(root, '--theme-danger-border', mix(danger, 38));
  setThemeVar(root, '--theme-danger-text', darkTheme ? mix(danger, 28, '#ffffff') : mix(danger, 70, colors.text));
  setThemeVar(root, '--theme-table-header-bg', mix(colors.text, darkTheme ? 6 : 4));
  setThemeVar(root, '--theme-table-hover-bg', mix(colors.primary, darkTheme ? 14 : 10));
  setThemeVar(root, '--theme-tag-bg', colors.tagBg);
  setThemeVar(root, '--theme-tag-border', mix(colors.tagText, 34));
  setThemeVar(root, '--theme-tag-text', colors.tagText);
  setThemeVar(root, '--theme-tag-fallback', colors.primary);
  setThemeVar(root, '--theme-tag-gradient-bg', mix(colors.primary, 20));
  setThemeVar(root, '--theme-admin-side-bg', colors.surfaceOverlay);
  setThemeVar(root, '--theme-admin-side-text', colors.text);
  setThemeVar(root, '--theme-admin-side-muted', colors.muted);
  setThemeVar(root, '--theme-admin-side-hover', mix(colors.primary, darkTheme ? 12 : 10));
  setThemeVar(root, '--theme-dock-bg', mix(colors.surfaceOverlay, 78));
  setThemeVar(root, '--theme-dock-border', mix(colors.line, 82));
  setThemeVar(root, '--theme-dock-text', colors.text);
  setThemeVar(root, '--theme-map-control-bg', colors.mapControlBg);
  setThemeVar(root, '--theme-map-control-text', colors.mapControlText);
  setThemeVar(root, '--theme-map-control-border', colors.line);
  setThemeVar(root, '--theme-map-control-hover-bg', colors.surface);
  setThemeVar(root, '--theme-map-control-hover-text', colors.text);
  setThemeVar(root, '--theme-map-popup-bg', colors.mapPopupBg);
  setThemeVar(root, '--theme-map-popup-text', colors.mapPopupText);
  setThemeVar(root, '--theme-map-popup-muted', colors.muted);
  setThemeVar(root, '--theme-map-popup-border', colors.line);
  setThemeVar(root, '--theme-map-popup-shadow', `0 18px 44px ${mix(colors.text, darkTheme ? 42 : 16)}`);
  setThemeVar(root, '--theme-map-marker-fill', colors.accent);
  setThemeVar(root, '--theme-map-marker-ring', colors.surfaceOverlay);
  setThemeVar(root, '--theme-map-marker-shadow', `0 4px 18px ${mix(colors.text, 30)}`);
  setThemeVar(root, '--theme-map-tile-filter', darkTheme ? 'brightness(0.72) contrast(1.12) saturate(0.84)' : 'saturate(0.96) contrast(0.98) brightness(1.02)');
  setThemeVar(root, '--theme-dock-active-bg', colors.dockActiveBg);
  setThemeVar(root, '--theme-dock-active-text', dockText);
  setThemeVar(root, '--theme-dock-tooltip-bg', colors.surfaceOverlay);
  setThemeVar(root, '--theme-dock-tooltip-text', colors.text);
  setThemeVar(root, '--theme-wall-page-bg', colors.pageBg);
  setThemeVar(root, '--theme-wall-card-bg', colors.surface);
  setThemeVar(root, '--theme-wall-card-body-bg', `linear-gradient(180deg, ${mix(colors.surface, 98)}, ${mix(colors.surfaceSoft, 98)})`);
  setThemeVar(root, '--theme-wall-card-text', colors.text);
  setThemeVar(root, '--theme-wall-card-muted', colors.muted);
  setThemeVar(root, '--theme-hero-shade-bg', `linear-gradient(90deg, ${mix(colors.pageBg, 82)}, ${mix(colors.pageBg, 18)} 48%, ${mix(colors.pageBg, 78)}), linear-gradient(180deg, ${mix(colors.pageBg, 18)}, ${mix(colors.pageBg, 78)})`);
  setThemeVar(root, '--theme-hero-text', colors.text);
  setThemeVar(root, '--theme-hero-kicker', colors.primary);
  setThemeVar(root, '--theme-hero-muted', mix(colors.textSoft, 78));
  setThemeVar(root, '--theme-hero-subtle', mix(colors.muted, 72));
  setThemeVar(root, '--theme-hero-control-bg', mix(colors.surfaceOverlay, 64));
  setThemeVar(root, '--theme-hero-control-border', colors.line);
  setThemeVar(root, '--theme-hero-control-text', colors.text);
  setThemeVar(root, '--theme-image-skeleton-base', mix(colors.surface, 84, colors.primary));
  setThemeVar(root, '--theme-image-skeleton-sheen', mix(readableOn(colors.surface), 14));
  setThemeVar(root, '--theme-image-hover-ring', mix(overlayText, 12));
  setThemeVar(root, '--theme-image-hover-top-shadow', mix(colors.imageOverlayBg, 36));
  setThemeVar(root, '--theme-image-hover-bottom-shadow', mix(colors.imageOverlayBg, 64));
  setThemeVar(root, '--theme-image-hover-scrim', mix(colors.imageOverlayBg, 8));
  setThemeVar(root, '--theme-image-overlay-bg', imageOverlay);
  setThemeVar(root, '--theme-image-overlay-bg-strong', imageOverlayStrong);
  setThemeVar(root, '--theme-image-overlay-border', mix(overlayText, 64));
  setThemeVar(root, '--theme-image-overlay-border-strong', mix(overlayText, 82));
  setThemeVar(root, '--theme-image-overlay-text', overlayText);
  setThemeVar(root, '--theme-image-overlay-muted', mix(overlayText, 86));
  setThemeVar(root, '--theme-image-overlay-shadow', `0 5px 18px ${mix(colors.imageOverlayBg, 22)}`);
  setThemeVar(root, '--theme-image-overlay-chip-bg', mix(colors.imageOverlayBg, 68));
  setThemeVar(root, '--theme-image-overlay-chip-bg-strong', mix(colors.imageOverlayBg, 82));
  setThemeVar(root, '--theme-lightbox-bg', lightboxBg);
  setThemeVar(root, '--theme-lightbox-text', lightboxText);
  setThemeVar(root, '--theme-lightbox-muted', mix(lightboxText, 84));
  setThemeVar(root, '--theme-lightbox-control-bg', mix(colors.imageOverlayBg, 62));
  setThemeVar(root, '--theme-lightbox-control-border', mix(lightboxText, 18));
  setThemeVar(root, '--theme-lightbox-shadow', `0 20px 80px ${mix(colors.imageOverlayBg, 48)}`);
  setThemeVar(root, '--theme-rate-limit-backdrop-a', mix(colors.primary, 18));
  setThemeVar(root, '--theme-rate-limit-backdrop-b', mix(colors.pageBg, 82));
  setThemeVar(root, '--theme-rate-limit-backdrop-c', mix(colors.surfaceSoft, 92));
  setThemeVar(root, '--theme-rate-limit-card-bg', `linear-gradient(145deg, ${mix(colors.surfaceOverlay, 98)}, ${mix(colors.surfaceSoft, 98)})`);
  setThemeVar(root, '--theme-rate-limit-mark', mix(colors.text, darkTheme ? 5 : 7));
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
      applyCustomThemeColors(this.settings);
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
