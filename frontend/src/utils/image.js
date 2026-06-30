const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f2933"/>
      <stop offset="1" stop-color="#0f1419"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="url(#g)"/>
  <rect x="282" y="180" width="396" height="280" rx="24" fill="none" stroke="rgba(255,255,255,.24)" stroke-width="8"/>
  <circle cx="388" cy="278" r="34" fill="rgba(255,255,255,.2)"/>
  <path d="M314 414 432 314l78 70 54-48 84 78" fill="none" stroke="rgba(255,255,255,.24)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export const fallbackImageUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(fallbackSvg)}`;

export const imageUrl = (url) => {
  if (!url) return fallbackImageUrl;
  if (/^https?:\/\//.test(url)) return url;
  return url;
};

const imageCandidateWidth = {
  thumbnailUrl: 480,
  smallUrl: 960,
  mediumUrl: 1600,
  originalUrl: 2400
};

export const photoImageSizes = {
  thumb: '96px',
  card: '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw',
  wall: '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, (max-width: 1700px) 25vw, 20vw',
  detail: '(max-width: 960px) 100vw, 64vw',
  album: '(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw',
  hero: '100vw',
  mapCard: '92px'
};

export const photoImageUrl = (photo, fields = ['thumbnailUrl', 'smallUrl', 'mediumUrl', 'originalUrl']) => {
  if (!photo || photo.externalStatus === 'failed') return fallbackImageUrl;
  const source = fields.map((field) => photo[field]).find(Boolean);
  return imageUrl(source);
};

export const photoImageSrcset = (photo, fields = ['thumbnailUrl', 'smallUrl', 'mediumUrl']) => {
  if (!photo || photo.externalStatus === 'failed') return '';
  const seen = new Set();
  return fields
    .map((field) => {
      const source = photo[field];
      const width = imageCandidateWidth[field];
      if (!source || !width) return null;
      const url = imageUrl(source);
      if (!url || url === fallbackImageUrl || seen.has(url)) return null;
      seen.add(url);
      return `${url} ${width}w`;
    })
    .filter(Boolean)
    .join(', ');
};

export const photoImageAttrs = (photo, {
  srcFields = ['thumbnailUrl', 'smallUrl', 'mediumUrl', 'originalUrl'],
  srcsetFields = ['thumbnailUrl', 'smallUrl', 'mediumUrl'],
  sizes = photoImageSizes.card
} = {}) => ({
  src: photoImageUrl(photo, srcFields),
  srcset: photoImageSrcset(photo, srcsetFields) || undefined,
  sizes
});

export const handleImageError = (event) => {
  const image = event?.target;
  if (!image || image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  image.src = fallbackImageUrl;
  image.classList.add('image-fallback');
};

export const albumCover = (album) => {
  if (!album) return imageUrl();
  if (album.coverPhoto?.externalStatus === 'failed' || album.photos?.[0]?.externalStatus === 'failed') {
    return fallbackImageUrl;
  }
  const cover = album.coverPhoto?.mediumUrl
    || album.coverPhoto?.smallUrl
    || album.coverPhoto?.thumbnailUrl
    || album.photos?.[0]?.mediumUrl
    || album.photos?.[0]?.smallUrl
    || album.photos?.[0]?.thumbnailUrl
    || album.coverUrl;
  return imageUrl(cover);
};

export const albumCoverSrcset = (album, fields = ['thumbnailUrl', 'smallUrl', 'mediumUrl']) => {
  const photo = album?.coverPhoto || album?.photos?.[0];
  return photoImageSrcset(photo, fields);
};

export const isExternalPhoto = (photo) => {
  if (!photo) return false;
  return photo.mimeType === 'image/external-url'
    || Number(photo.fileSize) === 0
    || /^https?:\/\//i.test(String(photo.originalUrl || photo.mediumUrl || photo.smallUrl || photo.thumbnailUrl || ''));
};

export const externalStatusText = (photo) => {
  if (photo?.externalStatus === 'cached') return '已缓存';
  if (!isExternalPhoto(photo)) return '本地';
  const status = photo.externalStatus || 'unchecked';
  const map = {
    unchecked: '未检测',
    ok: '外链正常',
    partial: '部分失效',
    failed: '外链失效',
    cached: '已缓存'
  };
  return map[status] || '未检测';
};

export const externalStatusLevel = (photo) => {
  if (photo?.externalStatus === 'cached') return 'muted';
  if (!isExternalPhoto(photo)) return 'local';
  const status = photo.externalStatus || 'unchecked';
  if (status === 'failed') return 'danger';
  if (status === 'partial') return 'warning';
  if (status === 'ok' || status === 'cached') return 'muted';
  return 'muted';
};
