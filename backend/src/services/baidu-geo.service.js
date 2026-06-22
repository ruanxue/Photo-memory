import { prisma } from '../config/prisma.js';

const BAIDU_API_ROOT = 'https://api.map.baidu.com';

const outOfChina = (lat, lng) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLat = (x, y) => {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return ret;
};

const transformLng = (x, y) => {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return ret;
};

const wgs84ToGcj02 = (lng, lat) => {
  if (outOfChina(lat, lng)) return [lng, lat];
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lng + dLng, lat + dLat];
};

const gcj02ToWgs84 = (lng, lat) => {
  if (outOfChina(lat, lng)) return [lng, lat];
  const [gLng, gLat] = wgs84ToGcj02(lng, lat);
  return [lng * 2 - gLng, lat * 2 - gLat];
};

const bd09ToGcj02 = (lng, lat) => {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * Math.PI * 3000 / 180);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * Math.PI * 3000 / 180);
  return [z * Math.cos(theta), z * Math.sin(theta)];
};

const bd09ToWgs84 = (lng, lat) => {
  if (outOfChina(Number(lat), Number(lng))) return [Number(lng), Number(lat)];
  const [gcjLng, gcjLat] = bd09ToGcj02(Number(lng), Number(lat));
  return gcj02ToWgs84(gcjLng, gcjLat);
};

const text = (value, max = 120) => String(value || '').replace(/[<>]/g, '').trim().slice(0, max);

const assertBaiduStatus = (payload) => {
  const status = Number(payload?.status);
  if (status === 0) return;
  const err = new Error(payload?.message || payload?.msg || '百度地图服务暂不可用');
  err.status = status === 302 || status === 401 ? 422 : 502;
  throw err;
};

const getServerAk = async () => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'baiduMapServerAk' } });
  const ak = String(setting?.value || '').trim();
  if (!ak) {
    const err = new Error('请先在系统设置中填写百度地图服务端 AK');
    err.status = 422;
    throw err;
  }
  return ak;
};

const fetchBaidu = async (path, params) => {
  const ak = await getServerAk();
  const url = new URL(path, BAIDU_API_ROOT);
  Object.entries({ ...params, ak, output: 'json' }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      const err = new Error('百度地图服务响应异常');
      err.status = 502;
      throw err;
    }
    assertBaiduStatus(payload);
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('百度地图服务请求超时');
      err.status = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const clampLatitude = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < -90 || number > 90) {
    const err = new Error('纬度必须在 -90 到 90 之间');
    err.status = 422;
    throw err;
  }
  return number;
};

const clampLongitude = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < -180 || number > 180) {
    const err = new Error('经度必须在 -180 到 180 之间');
    err.status = 422;
    throw err;
  }
  return number;
};

const normalizePoint = (point) => {
  if (!point || !Number.isFinite(Number(point.lng)) || !Number.isFinite(Number(point.lat))) return {};
  const [lng, lat] = bd09ToWgs84(Number(point.lng), Number(point.lat));
  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6))
  };
};

const normalizePlace = (item = {}) => {
  const country = text(item.country || item.nation || '中国', 60);
  const province = text(item.province, 80);
  const city = text(item.city, 80);
  const district = text(item.district || item.area, 80);
  const name = text(item.name || item.title || item.address, 120);
  const address = text(item.address || [province, city, district].filter(Boolean).join(' '), 180);
  return {
    name,
    address,
    country,
    province,
    city,
    district,
    locationName: name || district || city,
    uid: text(item.uid, 80),
    source: 'baidu',
    ...normalizePoint(item.location)
  };
};

export const searchBaiduPlaces = async ({ q, region, city, country, lat, lng }) => {
  const keyword = text(q, 80);
  if (!keyword) {
    const err = new Error('请输入地点关键词');
    err.status = 422;
    throw err;
  }
  const area = text(city || region || country || '全国', 80) || '全国';
  const payload = await fetchBaidu('/place/v2/suggestion', {
    query: keyword,
    region: area,
    city_limit: false,
    location: Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? `${lat},${lng}` : undefined
  });
  let items = Array.isArray(payload.result) ? payload.result : [];

  if (!items.length) {
    const fallback = await fetchBaidu('/place/v2/search', {
      query: keyword,
      region: area,
      city_limit: false,
      scope: 2
    });
    items = Array.isArray(fallback.results) ? fallback.results : [];
  }

  return items
    .map(normalizePlace)
    .filter((item) => item.name && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .slice(0, 12);
};

export const geocodeBaiduAddress = async ({ address, city }) => {
  const query = text(address, 180);
  if (!query) {
    const err = new Error('请输入地址');
    err.status = 422;
    throw err;
  }
  const payload = await fetchBaidu('/geocoding/v3/', {
    address: query,
    city: text(city, 80)
  });
  const point = normalizePoint(payload.result?.location);
  return {
    name: query,
    address: query,
    country: '中国',
    province: '',
    city: text(city, 80),
    district: '',
    locationName: query,
    uid: '',
    source: 'baidu',
    ...point
  };
};

export const reverseGeocodeBaidu = async ({ lat, lng }) => {
  const latitude = clampLatitude(lat);
  const longitude = clampLongitude(lng);
  const payload = await fetchBaidu('/reverse_geocoding/v3/', {
    location: `${latitude},${longitude}`,
    coordtype: 'wgs84ll',
    extensions_poi: 1,
    radius: 500
  });
  const result = payload.result || {};
  const component = result.addressComponent || {};
  const poi = Array.isArray(result.pois) ? result.pois[0] : null;
  const locationName = text(poi?.name || component.street || component.town || component.district || component.city, 120);
  return {
    name: locationName,
    address: text(result.formatted_address || result.sematic_description, 180),
    country: text(component.country || '中国', 60),
    province: text(component.province, 80),
    city: text(component.city, 80),
    district: text(component.district, 80),
    locationName,
    uid: text(poi?.uid, 80),
    source: 'baidu',
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6))
  };
};
