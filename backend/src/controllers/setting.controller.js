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
  'waterfallFullBleed'
]);
const numberKeys = new Set(['uploadMaxSizeMb', 'pageSize']);
const loadAnimations = new Set(['none', 'blur', 'custom']);
const themeModes = new Set(['light', 'dark', 'auto']);
const defaultSettings = {
  themeMode: 'light',
  waterfallFullBleed: 'false',
  waterfallLoadAnimation: 'blur',
  waterfallLoadDurationMs: '720',
  waterfallLoadStaggerMs: '24',
  waterfallCustomLoadCss: '',
  mapTileProvider: 'amap',
  mapTileUrl: '',
  mapTileAttribution: '© 高德地图'
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
  if (booleanKeys.has(key)) return value === 'true';
  if (key === 'waterfallColumns') return value === 'auto' ? 'auto' : Number(value);
  if (key === 'waterfallLoadAnimation') return loadAnimations.has(value) ? value : 'blur';
  if (key === 'waterfallLoadDurationMs') return clampNumber(value, 720, 200, 1600);
  if (key === 'waterfallLoadStaggerMs') return clampNumber(value, 24, 0, 120);
  if (key === 'waterfallCustomLoadCss') return sanitizeWaterfallLoadCss(value);
  if (key === 'mapTileProvider') return ['amap', 'osm', 'custom'].includes(value) ? value : 'amap';
  if (key === 'mapTileUrl') {
    const url = String(value || '').trim();
    if (!url || !/^https:\/\/[^<>"'\s]+$/i.test(url)) return '';
    return url.slice(0, 500);
  }
  if (key === 'mapTileAttribution') return String(value || '').replace(/[<>]/g, '').slice(0, 120);
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
  const rows = await prisma.systemSetting.findMany();
  const settings = rows.reduce((acc, item) => {
    acc[item.key] = normalizeValue(item.key, item.value);
    return acc;
  }, Object.fromEntries(Object.entries(defaultSettings).map(([key, value]) => [key, normalizeValue(key, value)])));
  success(res, settings);
};
