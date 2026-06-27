import {
  LEAFLET_MAX_ZOOM,
  MAP_MIN_ZOOM,
  WORLD_LAT_LIMIT,
  clampLatLng,
  clampZoom,
  normalizeMapProvider
} from './core.js';

export const createLeafletWorldBounds = (L) => L.latLngBounds(
  L.latLng(-WORLD_LAT_LIMIT, -180),
  L.latLng(WORLD_LAT_LIMIT, 180)
);

export const clampLeafletLatLng = (latitude, longitude, fallback) => clampLatLng(latitude, longitude, fallback);

export const clampLeafletZoom = (value, fallback = MAP_MIN_ZOOM, maxZoom = LEAFLET_MAX_ZOOM) => (
  clampZoom(value, fallback, maxZoom, MAP_MIN_ZOOM)
);

const withBounds = (options, worldBounds) => ({
  minZoom: MAP_MIN_ZOOM,
  noWrap: true,
  bounds: worldBounds,
  ...options
});

export const getLeafletTileConfig = (settings = {}, worldBounds) => {
  const provider = normalizeMapProvider(settings.mapTileProvider);

  if (provider === 'osm') {
    return {
      provider,
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: withBounds({
        subdomains: ['a', 'b', 'c'],
        attribution: settings.mapTileAttribution || '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }, worldBounds)
    };
  }

  if (provider === 'custom' && settings.mapTileUrl) {
    return {
      provider,
      url: settings.mapTileUrl,
      options: withBounds({
        subdomains: ['a', 'b', 'c', '1', '2', '3', '4'],
        attribution: settings.mapTileAttribution || '',
        maxZoom: 20
      }, worldBounds)
    };
  }

  return {
    provider: 'amap',
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    options: withBounds({
      subdomains: ['1', '2', '3', '4'],
      attribution: settings.mapTileAttribution || '© 高德地图',
      maxZoom: 18
    }, worldBounds)
  };
};

export const applyLeafletMapLimits = (map, tileConfig, worldBounds) => {
  if (!map) return;
  const maxZoom = Number(tileConfig?.options?.maxZoom) || 18;
  map.setMinZoom(MAP_MIN_ZOOM);
  map.setMaxZoom(maxZoom);
  map.setMaxBounds(worldBounds);
  map.options.maxBoundsViscosity = 1;
  map.panInsideBounds(worldBounds, { animate: false });
};
