const baiduMapPromises = new Map();

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

export const gcj02ToBd09 = (lng, lat) => {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * Math.PI * 3000 / 180);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * Math.PI * 3000 / 180);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
};

export const bd09ToGcj02 = (lng, lat) => {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * Math.PI * 3000 / 180);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * Math.PI * 3000 / 180);
  return [z * Math.cos(theta), z * Math.sin(theta)];
};

export const wgs84ToBd09 = (lng, lat) => {
  const [gcjLng, gcjLat] = wgs84ToGcj02(Number(lng), Number(lat));
  if (outOfChina(Number(lat), Number(lng))) return [Number(lng), Number(lat)];
  return gcj02ToBd09(gcjLng, gcjLat);
};

export const bd09ToWgs84 = (lng, lat) => {
  if (outOfChina(Number(lat), Number(lng))) return [Number(lng), Number(lat)];
  const [gcjLng, gcjLat] = bd09ToGcj02(Number(lng), Number(lat));
  return gcj02ToWgs84(gcjLng, gcjLat);
};

export const loadBaiduMapGL = (ak) => {
  const webAk = String(ak || '').trim();
  if (!webAk) return Promise.reject(new Error('请先在后台填写百度地图 Web 端 AK'));
  if (typeof window === 'undefined') return Promise.reject(new Error('浏览器环境不可用'));
  if (window.BMapGL) return Promise.resolve(window.BMapGL);

  if (baiduMapPromises.has(webAk)) return baiduMapPromises.get(webAk);
  const waitForBMapGL = (resolve, reject, attempts = 0) => {
    if (window.BMapGL) {
      resolve(window.BMapGL);
      return;
    }
    if (attempts >= 40) {
      reject(new Error('BMapGL 未初始化，请检查百度 Web 端 AK、JSAPI GL 服务和 Referer 白名单。'));
      return;
    }
    window.setTimeout(() => waitForBMapGL(resolve, reject, attempts + 1), 50);
  };

  const promise = new Promise((resolve, reject) => {
    const callbackName = `__photoMemoryBMapGL_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timeoutId = window.setTimeout(() => {
      delete window[callbackName];
      reject(new Error('百度地图 JSAPI GL 加载超时，请检查 Web 端 AK、JSAPI GL 服务和 Referer 白名单。'));
    }, 8000);

    window[callbackName] = () => {
      window.clearTimeout(timeoutId);
      waitForBMapGL(
        (BMapGL) => {
          delete window[callbackName];
          resolve(BMapGL);
        },
        (error) => {
          delete window[callbackName];
          reject(error);
        }
      );
    };

    const existing = document.querySelector('script[data-baidu-map-gl]');
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${encodeURIComponent(webAk)}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.dataset.baiduMapGl = webAk;
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      reject(new Error('百度地图 JSAPI GL 加载失败，请检查网络、AK 和域名白名单。'));
    };
    document.head.appendChild(script);
  });

  baiduMapPromises.set(webAk, promise);
  return promise;
};

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
