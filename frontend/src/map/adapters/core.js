export const MAP_MIN_ZOOM = 3;
export const LEAFLET_MAX_ZOOM = 20;
export const BAIDU_MAX_ZOOM = 19;
export const DEFAULT_MAP_CENTER = [30.67, 104.06];
export const WORLD_LAT_LIMIT = 85.05112878;
export const BAIDU_LAT_LIMIT = 85;
export const WORLD_LNG_LIMIT = 180;

export const mapProviders = new Set(['amap', 'osm', 'custom', 'baidu']);

export const normalizeMapProvider = (provider = 'amap') => {
  const value = String(provider || '').trim();
  return mapProviders.has(value) ? value : 'amap';
};

export const isBaiduMapProvider = (settings = {}) => normalizeMapProvider(settings.mapTileProvider) === 'baidu';

export const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : min;
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : safeFallback));
};

export const clampZoom = (value, fallback = MAP_MIN_ZOOM, maxZoom = LEAFLET_MAX_ZOOM, minZoom = MAP_MIN_ZOOM) => (
  clampNumber(value, minZoom, maxZoom, fallback)
);

export const clampLatLng = (
  latitude,
  longitude,
  fallback = DEFAULT_MAP_CENTER,
  latLimit = WORLD_LAT_LIMIT
) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const fallbackLat = Number(fallback?.[0]);
  const fallbackLng = Number(fallback?.[1]);
  return [
    Math.max(-latLimit, Math.min(latLimit, Number.isFinite(lat) ? lat : (Number.isFinite(fallbackLat) ? fallbackLat : DEFAULT_MAP_CENTER[0]))),
    Math.max(-WORLD_LNG_LIMIT, Math.min(WORLD_LNG_LIMIT, Number.isFinite(lng) ? lng : (Number.isFinite(fallbackLng) ? fallbackLng : DEFAULT_MAP_CENTER[1])))
  ];
};

export const hasValidCoordinates = (item = {}) => (
  Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
);
