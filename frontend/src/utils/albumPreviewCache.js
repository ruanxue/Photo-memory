const CACHE_KEY_PREFIX = 'photo-memory:album-preview:';
const LIST_CACHE_KEY = 'photo-memory:album-list-preview';
const MEMORY_CACHE_KEY = '__photoMemoryAlbumPreviewCache';
const LIST_MEMORY_CACHE_KEY = '__photoMemoryAlbumListPreviewCache';

const cacheKey = (id) => `${CACHE_KEY_PREFIX}${id}`;

const runtimeCache = () => {
  if (typeof window === 'undefined') return null;
  if (!window[MEMORY_CACHE_KEY]) window[MEMORY_CACHE_KEY] = new Map();
  return window[MEMORY_CACHE_KEY];
};

const listRuntimeCache = () => {
  if (typeof window === 'undefined') return null;
  return Array.isArray(window[LIST_MEMORY_CACHE_KEY]) ? window[LIST_MEMORY_CACHE_KEY] : null;
};

const toPlain = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
};

const sameId = (album, id) => Number(album?.id) === Number(id);

const withPhotoFallback = (preview) => {
  if (!preview) return null;
  const photos = Array.isArray(preview.photos) ? preview.photos.filter(Boolean) : [];
  const coverPhoto = preview.coverPhoto || photos[0] || null;
  return {
    ...preview,
    coverPhoto,
    photos: photos.length ? photos : (coverPhoto ? [coverPhoto] : [])
  };
};

export const normalizeAlbumPreview = (album) => {
  if (!album?.id) return null;
  const photos = Array.isArray(album.photos) ? album.photos.filter(Boolean) : [];
  const coverPhoto = album.coverPhoto || photos[0] || null;
  const previewPhotos = photos.length ? photos : (coverPhoto ? [coverPhoto] : []);
  return toPlain({
    id: album.id,
    title: album.title,
    description: album.description,
    startDate: album.startDate,
    endDate: album.endDate,
    createdAt: album.createdAt,
    photoCount: album.photoCount ?? previewPhotos.length,
    coverPhoto,
    photos: previewPhotos
  });
};

const normalizeAlbumList = (albums) => (
  Array.isArray(albums) ? albums.map(normalizeAlbumPreview).filter(Boolean) : []
);

const storeAlbumListPreview = (previews) => {
  if (typeof window === 'undefined') return;
  window[LIST_MEMORY_CACHE_KEY] = previews;
  try {
    window.sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify(previews));
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
};

const readRawAlbumListPreview = () => {
  if (typeof window === 'undefined') return [];
  const fromMemory = listRuntimeCache();
  if (fromMemory?.length) return fromMemory;

  try {
    const raw = window.sessionStorage.getItem(LIST_CACHE_KEY);
    const fromStorage = raw ? JSON.parse(raw) : null;
    return Array.isArray(fromStorage) ? fromStorage.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const syncAlbumPreviewToList = (preview) => {
  const cachedList = readRawAlbumListPreview();
  if (!cachedList.length) return;
  let matched = false;
  const nextList = cachedList.map((album) => {
    if (!sameId(album, preview.id)) return album;
    matched = true;
    return { ...album, ...preview };
  });
  if (matched) storeAlbumListPreview(nextList);
};

export const rememberAlbumListPreview = (albums) => {
  const previews = normalizeAlbumList(albums);
  const memory = runtimeCache();
  if (memory) {
    previews.forEach((preview) => memory.set(String(preview.id), preview));
  }
  storeAlbumListPreview(previews);
  return previews;
};

export const readAlbumListPreview = () => (
  readRawAlbumListPreview().map(withPhotoFallback).filter(Boolean)
);

export const rememberAlbumPreview = (album) => {
  const preview = normalizeAlbumPreview(album);
  if (!preview) return null;
  const id = String(preview.id);
  const memory = runtimeCache();
  if (memory) memory.set(id, preview);
  syncAlbumPreviewToList(preview);
  try {
    window.sessionStorage.setItem(cacheKey(id), JSON.stringify(preview));
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
  return preview;
};

export const readAlbumPreview = (id, routeState) => {
  const fromState = routeState?.albumPreview;
  if (sameId(fromState, id)) return withPhotoFallback(fromState);

  const memory = runtimeCache();
  const fromMemory = memory?.get(String(id));
  if (sameId(fromMemory, id)) return withPhotoFallback(fromMemory);

  try {
    const raw = window.sessionStorage.getItem(cacheKey(id));
    const fromStorage = raw ? JSON.parse(raw) : null;
    if (sameId(fromStorage, id)) return withPhotoFallback(fromStorage);
  } catch {
    // Ignore malformed or unavailable preview data.
  }

  return null;
};

export const createAlbumShell = (id) => {
  const numericId = Number(id);
  return {
    id: Number.isFinite(numericId) ? numericId : id,
    title: 'PHOTO MEMORY',
    description: '',
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    photoCount: 0,
    coverPhoto: null,
    photos: []
  };
};
