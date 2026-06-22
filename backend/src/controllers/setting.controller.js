import { prisma } from '../config/prisma.js';
import { success } from '../utils/response.js';

const booleanKeys = new Set([
  'allowRegister',
  'allowUserUpload',
  'commentsEnabled',
  'commentReview',
  'hideLoginEntry',
  'watermarkEnabled',
  'includeAlbumsInWaterfall',
  'showExifOnHover',
  'waterfallFullBleed',
  'themeCustomEnabled'
]);
const numberKeys = new Set(['uploadMaxSizeMb', 'pageSize']);
const mapZoomKeys = new Set(['mapPageZoomChina', 'mapPageZoomOverseas', 'mapDetailZoomChina', 'mapDetailZoomOverseas']);
const loadAnimations = new Set(['none', 'blur', 'custom']);
const revealAnimations = new Set(['slide-up', 'fade', 'none']);
const themeModes = new Set(['light', 'dark', 'auto']);
const themeEditorModes = new Set(['simple', 'advanced']);
const defaultSettings = {
  themeMode: 'light',
  themeCustomEnabled: 'false',
  themeCustomName: '',
  themeCustomEditorMode: 'simple',
  themeCustomColors: '{}',
  savedThemes: '[]',
  waterfallFullBleed: 'false',
  waterfallCardRadius: '4',
  waterfallRevealAnimation: 'slide-up',
  waterfallLoadAnimation: 'blur',
  waterfallLoadDurationMs: '720',
  waterfallLoadStaggerMs: '24',
  waterfallCustomLoadCss: '',
  mapTileProvider: 'amap',
  mapTileUrl: '',
  baiduMapWebAk: '',
  mapPageZoomChina: '12',
  mapPageZoomOverseas: '7',
  mapDetailZoomChina: '11',
  mapDetailZoomOverseas: '7',
  mapTileAttribution: '© 高德地图'
};

const privatePublicSettingKeys = new Set(['baiduMapServerAk']);

const themeColorKeys = new Set([
  'primary',
  'accent',
  'pageBg',
  'surface',
  'surfaceSoft',
  'surfaceOverlay',
  'text',
  'textSoft',
  'muted',
  'line',
  'buttonBg',
  'buttonText',
  'buttonHoverBg',
  'tagBg',
  'tagText',
  'mapControlBg',
  'mapControlText',
  'mapPopupBg',
  'mapPopupText',
  'dockActiveBg',
  'dockActiveText',
  'imageOverlayBg',
  'imageOverlayText'
]);
const colorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHexColor = (value) => {
  const color = String(value || '').trim();
  if (!colorPattern.test(color)) return '';
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return color.toLowerCase();
};

const sanitizeThemeColors = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value || '{}');
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key]) => themeColorKeys.has(key))
      .map(([key, color]) => [key, normalizeHexColor(color)])
      .filter(([, color]) => color)
  );
};

const sanitizeSavedThemes = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value || '[]');
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 16).map((theme, index) => {
    const name = String(theme?.name || `主题 ${index + 1}`).replace(/[<>]/g, '').trim().slice(0, 32);
    return {
      id: String(theme?.id || Date.now() + index).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || String(index + 1),
      name: name || `主题 ${index + 1}`,
      colors: sanitizeThemeColors(theme?.colors || {}),
      savedAt: String(theme?.savedAt || '').replace(/[<>]/g, '').slice(0, 32)
    };
  }).filter((theme) => Object.keys(theme.colors).length);
};

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeIds = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map(Number).filter((item) => Number.isInteger(item) && item > 0))];
    }
  } catch {
    // Support older comma-separated values if they ever appear in settings.
  }
  return [...new Set(String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0))];
};

const sanitizeWaterfallLoadCss = (value = '') => {
  const rules = String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .slice(0, 900)
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean);

  const safeRules = [];
  for (const rule of rules) {
    const separator = rule.indexOf(':');
    if (separator <= 0) continue;
    const property = rule.slice(0, separator).trim().toLowerCase();
    const rawValue = rule.slice(separator + 1).trim();
    if (!rawValue || /url\s*\(|@import|expression\s*\(|javascript:|<|>/i.test(rawValue)) continue;

    if (property === 'opacity') {
      const opacity = Number(rawValue);
      if (Number.isFinite(opacity)) safeRules.push(`opacity: ${Math.max(0, Math.min(1, opacity))}`);
    } else if (property === 'filter' && rawValue.length <= 160) {
      safeRules.push(`filter: ${rawValue}`);
    } else if (property === 'transform' && rawValue.length <= 180) {
      safeRules.push(`transform: ${rawValue}`);
    } else if ((property === 'transition-timing-function' || property === 'animation-timing-function') && /^[a-z0-9.,()\s-]+$/i.test(rawValue)) {
      safeRules.push(`transition-timing-function: ${rawValue.slice(0, 90)}`);
    }
  }

  return safeRules.slice(0, 6).join('; ');
};

const normalizeValue = (key, value) => {
  if (key === 'themeMode') return themeModes.has(value) ? value : 'light';
  if (key === 'themeCustomEditorMode') return themeEditorModes.has(value) ? value : 'simple';
  if (key === 'themeCustomName') return String(value || '').replace(/[<>]/g, '').trim().slice(0, 32);
  if (key === 'themeCustomColors') return sanitizeThemeColors(value);
  if (key === 'savedThemes') return sanitizeSavedThemes(value);
  if (booleanKeys.has(key)) return value === 'true';
  if (key === 'waterfallColumns') return value === 'auto' ? 'auto' : Number(value);
  if (key === 'waterfallCardRadius') return clampNumber(value, 4, 0, 24);
  if (key === 'waterfallRevealAnimation') return revealAnimations.has(value) ? value : 'slide-up';
  if (key === 'waterfallLoadAnimation') return loadAnimations.has(value) ? value : 'blur';
  if (key === 'waterfallLoadDurationMs') return clampNumber(value, 720, 200, 1600);
  if (key === 'waterfallLoadStaggerMs') return clampNumber(value, 24, 0, 120);
  if (key === 'waterfallCustomLoadCss') return sanitizeWaterfallLoadCss(value);
  if (key === 'mapTileProvider') return ['amap', 'osm', 'custom', 'baidu'].includes(value) ? value : 'amap';
  if (mapZoomKeys.has(key)) {
    const fallback = key === 'mapPageZoomChina' ? 12 : key === 'mapDetailZoomChina' ? 11 : 7;
    return clampNumber(value, fallback, 3, 14);
  }
  if (key === 'mapTileUrl') {
    const url = String(value || '').trim();
    if (!url || !/^https:\/\/[^<>"'\s]+$/i.test(url)) return '';
    return url.slice(0, 500);
  }
  if (key === 'mapTileAttribution') return String(value || '').replace(/[<>]/g, '').slice(0, 120);
  if (key === 'baiduMapWebAk') return String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 120);
  if (key === 'baiduMapServerAk') return '';
  if (key === 'heroMode') return value === 'fixed' ? 'fixed' : 'random';
  if (key === 'heroPhotoIds') return normalizeIds(value);
  if (key === 'heroFixedPhotoId') {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  if (key === 'trustProxyHops') {
    const hops = Number(value);
    return Number.isInteger(hops) && hops >= 0 ? hops : 0;
  }
  if (numberKeys.has(key)) return Number(value);
  return value;
};

export const publicSettings = async (req, res) => {
  const rows = await prisma.systemSetting.findMany({ where: { key: { notIn: [...privatePublicSettingKeys] } } });
  const settings = rows.reduce((acc, item) => {
    acc[item.key] = normalizeValue(item.key, item.value);
    return acc;
  }, Object.fromEntries(Object.entries(defaultSettings).map(([key, value]) => [key, normalizeValue(key, value)])));
  success(res, settings);
};
