<template>
  <div class="map-shell baidu-map-shell" :style="{ height }">
    <div ref="mapEl" class="map-canvas"></div>
    <div v-if="errorMessage" class="map-hint">
      <strong>百度地图加载失败</strong>
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { imageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { escapeHtml, loadBaiduMapGL, wgs84ToBd09 } from '../../utils/baidu-map.js';

const props = defineProps({
  photos: { type: Array, default: () => [] },
  center: { type: Array, default: () => [30.67, 104.06] },
  zoom: { type: Number, default: 4 },
  fitMaxZoom: { type: Number, default: 12 },
  focusZoom: { type: Number, default: 14 },
  height: { type: String, default: '520px' },
  showPopup: { type: Boolean, default: true }
});

const emit = defineEmits(['detail']);
const settings = useSettingsStore();
const mapEl = ref(null);
const errorMessage = ref('');
let BMapGL;
let map;
let markers = [];
let popupOverlay = null;
const markerByPhotoId = new Map();
let focusedPhotoId = null;
let focusTimers = [];

const clampZoom = (zoom, fallback = props.zoom) => {
  const value = Number(zoom);
  const fallbackValue = Number(fallback) || 4;
  return Math.max(3, Math.min(19, Number.isFinite(value) ? value : fallbackValue));
};

const clampLatLng = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return [
    Math.max(-85, Math.min(85, Number.isFinite(lat) ? lat : props.center[0])),
    Math.max(-180, Math.min(180, Number.isFinite(lng) ? lng : props.center[1]))
  ];
};

const toBdPoint = (latitude, longitude) => {
  const [lat, lng] = clampLatLng(latitude, longitude);
  const [bdLng, bdLat] = wgs84ToBd09(lng, lat);
  return new BMapGL.Point(bdLng, bdLat);
};

const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const markerIcon = (active = false) => {
  const fill = active ? cssVar('--theme-primary', '#1683ff') : cssVar('--theme-map-marker-fill', '#b66f54');
  const ring = cssVar('--theme-map-marker-ring', '#ffffff');
  const size = active ? 30 : 24;
  const radius = active ? 11 : 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${fill}" stroke="${ring}" stroke-width="4"/></svg>`;
  return new BMapGL.Icon(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, new BMapGL.Size(size, size), {
    anchor: new BMapGL.Size(size / 2, size / 2)
  });
};

const popupHtml = (photo) => `
  <a href="/photos/${photo.id}" class="baidu-map-card-popup" aria-label="查看照片 ${escapeHtml(photo.title)}">
    <img src="${escapeHtml(imageUrl(photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl))}" alt="${escapeHtml(photo.title)}" />
    <strong>${escapeHtml(photo.title)}</strong>
    <span>${escapeHtml(photo.city || photo.locationName || '')} ${formatDate(photo.takenAt || photo.uploadedAt)}</span>
  </a>
`;

const closePopup = () => {
  if (popupOverlay && map) map.removeOverlay(popupOverlay);
  popupOverlay = null;
};

const isPointerOnPopup = () => {
  const element = popupOverlay?.div;
  if (!element) return false;
  return element.matches(':hover') || Boolean(element.querySelector(':hover'));
};

const clearFocusTimers = () => {
  focusTimers.forEach((timer) => window.clearTimeout(timer));
  focusTimers = [];
};

const queueFocusStep = (callback, delay) => {
  const timer = window.setTimeout(() => {
    focusTimers = focusTimers.filter((item) => item !== timer);
    callback();
  }, delay);
  focusTimers.push(timer);
};

const openPopup = (photo, point, onEnter, onLeave) => {
  if (!map || !BMapGL) return;
  closePopup();
  function PhotoPopupOverlay() {}
  PhotoPopupOverlay.prototype = new BMapGL.Overlay();
  PhotoPopupOverlay.prototype.initialize = function initialize(currentMap) {
    this.map = currentMap;
    const div = document.createElement('div');
    div.className = 'baidu-photo-popup-overlay';
    div.innerHTML = popupHtml(photo);
    div.addEventListener('mouseenter', onEnter);
    div.addEventListener('mouseleave', onLeave);
    div.addEventListener('pointerenter', onEnter);
    div.addEventListener('pointerleave', onLeave);
    div.addEventListener('mouseover', onEnter);
    div.addEventListener('click', (event) => {
      if (!event.target?.closest?.('.baidu-map-card-popup')) return;
      event.preventDefault();
      event.stopPropagation();
      emit('detail', photo);
    });
    currentMap.getPanes().floatPane.appendChild(div);
    this.div = div;
    return div;
  };
  PhotoPopupOverlay.prototype.draw = function draw() {
    const pixel = this.map.pointToOverlayPixel(point);
    this.div.style.left = `${pixel.x}px`;
    this.div.style.top = `${pixel.y - 22}px`;
  };
  popupOverlay = new PhotoPopupOverlay();
  map.addOverlay(popupOverlay);
};

const setFocusedMarker = (photoId) => {
  focusedPhotoId = photoId ? Number(photoId) : null;
  markerByPhotoId.forEach((marker, id) => {
    marker.setIcon(markerIcon(id === focusedPhotoId));
  });
};

const bindMarkerPopup = (marker, photo, point) => {
  if (!props.showPopup) return;
  let closeTimer = null;
  let markerHovered = false;
  let popupHovered = false;

  const closeLater = () => {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (markerHovered || popupHovered || isPointerOnPopup()) {
        popupHovered = true;
        return;
      }
      closePopup();
    }, 420);
  };

  const open = () => {
    markerHovered = true;
    window.clearTimeout(closeTimer);
    openPopup(
      photo,
      point,
      () => {
        popupHovered = true;
        window.clearTimeout(closeTimer);
      },
      () => {
        popupHovered = false;
        closeLater();
      }
    );
  };

  const leaveMarker = () => {
    markerHovered = false;
    closeLater();
  };

  marker.addEventListener('mouseover', open);
  marker.addEventListener('mouseout', leaveMarker);
  marker.addEventListener('click', open);
};

const clearMarkers = () => {
  markers.forEach((marker) => map?.removeOverlay(marker));
  markers = [];
  markerByPhotoId.clear();
};

const renderMarkers = () => {
  if (!map || !BMapGL) return;
  clearMarkers();
  closePopup();
  const points = [];
  props.photos
    .filter((photo) => photo.latitude && photo.longitude)
    .forEach((photo) => {
      const point = toBdPoint(photo.latitude, photo.longitude);
      const marker = new BMapGL.Marker(point, { icon: markerIcon(Number(photo.id) === focusedPhotoId) });
      map.addOverlay(marker);
      bindMarkerPopup(marker, photo, point);
      markers.push(marker);
      markerByPhotoId.set(Number(photo.id), marker);
      points.push(point);
    });

  if (points.length === 1) {
    map.centerAndZoom(points[0], clampZoom(props.fitMaxZoom, props.zoom));
  } else if (points.length > 1) {
    map.setViewport(points, { margins: [32, 32, 32, 32] });
    if (map.getZoom() > props.fitMaxZoom) map.setZoom(clampZoom(props.fitMaxZoom));
  }
  setFocusedMarker(focusedPhotoId);
};

const focusPhoto = async (photoOrId, zoomOverride = props.focusZoom) => {
  const photoId = Number(typeof photoOrId === 'object' ? photoOrId?.id : photoOrId);
  if (!map || !Number.isFinite(photoId)) return false;
  await nextTick();
  const photo = props.photos.find((item) => Number(item.id) === photoId);
  const marker = markerByPhotoId.get(photoId);
  if (!photo?.latitude || !photo?.longitude || !marker) return false;

  const point = toBdPoint(photo.latitude, photo.longitude);
  setFocusedMarker(photoId);
  clearFocusTimers();
  closePopup();
  const targetZoom = clampZoom(zoomOverride, props.focusZoom);
  map.centerAndZoom(point, targetZoom);
  if (props.showPopup) {
    queueFocusStep(() => {
      openPopup(photo, point, () => {}, closePopup);
    }, 80);
  }
  return true;
};

const init = async () => {
  try {
    errorMessage.value = '';
    BMapGL = await loadBaiduMapGL(settings.settings.baiduMapWebAk);
    const start = toBdPoint(props.center?.[0], props.center?.[1]);
    map = new BMapGL.Map(mapEl.value, {
      enableMapClick: false,
      minZoom: 3,
      maxZoom: 19
    });
    map.centerAndZoom(start, clampZoom(props.zoom));
    map.enableScrollWheelZoom(true);
    map.addControl(new BMapGL.ZoomControl());
    renderMarkers();
  } catch (error) {
    errorMessage.value = error.message || '请检查百度地图 Web 端 AK 和服务开通状态。';
  }
};

onMounted(init);
watch(() => props.photos, renderMarkers, { deep: true });
watch(() => props.height, async () => {
  await nextTick();
  map?.checkResize?.();
});
watch(() => props.showPopup, renderMarkers);
watch(() => settings.settings.baiduMapWebAk, () => {
  map?.destroy?.();
  map = null;
  init();
});

onBeforeUnmount(() => {
  clearFocusTimers();
  clearMarkers();
  map?.destroy?.();
});

defineExpose({ focusPhoto });
</script>

<style>
.baidu-map-shell .BMap_cpyCtrl {
  color: var(--theme-map-popup-muted) !important;
}

.baidu-map-shell .anchorBL {
  color: var(--theme-map-popup-muted) !important;
}

.baidu-photo-popup-overlay {
  position: absolute;
  z-index: 40;
  transform: translate(-50%, -100%);
  pointer-events: auto;
}

.baidu-photo-popup-overlay,
.baidu-photo-popup-overlay * {
  pointer-events: auto;
}

.baidu-photo-popup-overlay::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -38px;
  width: 82px;
  height: 42px;
  transform: translateX(-50%);
  background: transparent;
  pointer-events: auto;
}

.baidu-photo-popup-overlay::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -7px;
  width: 14px;
  height: 14px;
  border-right: 1px solid var(--theme-map-popup-border);
  border-bottom: 1px solid var(--theme-map-popup-border);
  background: var(--theme-map-popup-bg);
  transform: translateX(-50%) rotate(45deg);
}

.baidu-map-card-popup {
  position: relative;
  z-index: 1;
  min-width: 178px;
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--theme-map-popup-border);
  border-radius: 12px;
  color: var(--theme-map-popup-text) !important;
  background: var(--theme-map-popup-bg);
  box-shadow: var(--theme-map-popup-shadow);
  text-decoration: none;
  backdrop-filter: blur(12px);
}

.baidu-map-card-popup img {
  width: 160px;
  height: 96px;
  object-fit: cover;
  border-radius: 8px;
}

.baidu-map-card-popup strong {
  color: var(--theme-map-popup-text);
  font-size: 13px;
  line-height: 1.35;
}

.baidu-map-card-popup span {
  color: var(--theme-map-popup-muted);
  font-size: 12px;
}
</style>

<style scoped>
.map-shell {
  position: relative;
  width: 100%;
  min-height: 260px;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--theme-surface-soft);
}

.map-canvas {
  width: 100%;
  height: 100%;
  min-height: inherit;
}

.map-hint {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 20;
  max-width: min(320px, calc(100% - 28px));
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  color: var(--theme-text);
  background: var(--theme-surface-glass);
  box-shadow: var(--theme-shadow);
  backdrop-filter: blur(12px);
}

.map-hint strong {
  font-size: 13px;
}

.map-hint span {
  color: var(--theme-muted-strong);
  font-size: 12px;
  line-height: 1.6;
}
</style>
