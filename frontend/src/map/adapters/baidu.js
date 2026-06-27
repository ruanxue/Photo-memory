import {
  BAIDU_LAT_LIMIT,
  BAIDU_MAX_ZOOM,
  DEFAULT_MAP_CENTER,
  MAP_MIN_ZOOM,
  clampLatLng,
  clampZoom
} from './core.js';
import {
  bd09ToWgs84,
  escapeHtml,
  loadBaiduMapGL,
  wgs84ToBd09
} from '../../utils/baidu-map.js';

export { bd09ToWgs84, escapeHtml, loadBaiduMapGL, wgs84ToBd09 };

export const clampBaiduZoom = (value, fallback = 4) => (
  clampZoom(value, fallback, BAIDU_MAX_ZOOM, MAP_MIN_ZOOM)
);

export const clampBaiduLatLng = (latitude, longitude, fallback = DEFAULT_MAP_CENTER) => (
  clampLatLng(latitude, longitude, fallback, BAIDU_LAT_LIMIT)
);

export const toBaiduPoint = (BMapGL, latitude, longitude, fallback = DEFAULT_MAP_CENTER) => {
  const [lat, lng] = clampBaiduLatLng(latitude, longitude, fallback);
  const [bdLng, bdLat] = wgs84ToBd09(lng, lat);
  return new BMapGL.Point(bdLng, bdLat);
};

export const baiduPointToWgs84LatLng = (point, fallback = DEFAULT_MAP_CENTER) => {
  const [lng, lat] = bd09ToWgs84(point.lng, point.lat);
  return clampBaiduLatLng(lat, lng, fallback);
};
