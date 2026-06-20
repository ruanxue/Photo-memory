const chinaCountryNames = new Set([
  '\u4e2d\u56fd',
  '\u4e2d\u56fd\u5927\u9646',
  '\u4e2d\u534e\u4eba\u6c11\u5171\u548c\u56fd',
  'china',
  'cn',
  'prc',
  'hong kong',
  '\u9999\u6e2f',
  'macau',
  '\u6fb3\u95e8',
  'taiwan',
  '\u53f0\u6e7e'
]);

export const isChinaCountry = (country = '') => {
  const normalized = String(country || '').trim().toLowerCase();
  if (!normalized) return false;
  return chinaCountryNames.has(normalized) || normalized.includes('\u4e2d\u56fd');
};

export const mapSceneForPhoto = (photo = {}) => {
  if (!photo?.country) return 'china';
  return isChinaCountry(photo.country) ? 'china' : 'overseas';
};

export const mapSceneForPhotos = (photos = [], selectedCountry = '') => {
  if (selectedCountry) return isChinaCountry(selectedCountry) ? 'china' : 'overseas';
  const countries = photos.map((photo) => photo?.country).filter(Boolean);
  if (!countries.length) return 'china';
  return countries.every((country) => !isChinaCountry(country)) ? 'overseas' : 'china';
};

export const clampMapZoom = (value, fallback = 10) => {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return fallback;
  return Math.max(3, Math.min(14, Math.round(zoom)));
};

export const mapZoomForScene = (settings = {}, scene = 'china', usage = 'page') => {
  const overseas = scene === 'overseas';
  if (usage === 'detail') {
    return clampMapZoom(
      overseas ? settings.mapDetailZoomOverseas : settings.mapDetailZoomChina,
      overseas ? 7 : 11
    );
  }
  return clampMapZoom(
    overseas ? settings.mapPageZoomOverseas : settings.mapPageZoomChina,
    overseas ? 7 : 12
  );
};
