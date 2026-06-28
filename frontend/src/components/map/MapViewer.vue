<template>
  <BaiduMapViewer
    v-if="isBaiduProvider"
    ref="baiduViewer"
    :photos="photos"
    :center="center"
    :zoom="zoom"
    :fit-max-zoom="fitMaxZoom"
    :focus-zoom="focusZoom"
    :height="height"
    :show-popup="showPopup"
    @detail="emit('detail', $event)"
  />
  <div v-else class="map-shell" :style="{ height }">
    <div ref="mapEl" class="map-canvas"></div>
    <div v-if="tileErrorVisible" class="map-hint">
      <strong>地图底图加载缓慢</strong>
      <span>可在后台系统设置中切换为高德地图或自定义 HTTPS 瓦片源。</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import { photoImageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { MAP_MIN_ZOOM, isBaiduMapProvider } from '../../map/adapters/core.js';
import {
  applyLeafletMapLimits,
  clampLeafletLatLng,
  clampLeafletZoom,
  createLeafletWorldBounds,
  getLeafletTileConfig
} from '../../map/adapters/leaflet.js';
import BaiduMapViewer from './BaiduMapViewer.vue';

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
const mapEl = ref(null);
const baiduViewer = ref(null);
const settings = useSettingsStore();
const tileErrorVisible = ref(false);
let map;
let tileLayer;
let attributionControl;
let markers = [];
const markerByPhotoId = new Map();
let focusedPhotoId = null;
const isBaiduProvider = computed(() => isBaiduMapProvider(settings.settings));
const worldBounds = createLeafletWorldBounds(L);

const clampZoom = (zoom, fallback = props.zoom) => {
  const maxZoom = Number(providerConfig.value?.options?.maxZoom) || 18;
  return clampLeafletZoom(zoom, fallback, maxZoom);
};

const clampLatLng = (latitude, longitude) => clampLeafletLatLng(latitude, longitude, props.center);

const applyMapLimits = () => {
  applyLeafletMapLimits(map, providerConfig.value, worldBounds);
};

const markerIcon = L.divIcon({
  className: 'photo-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const setFocusedMarker = (photoId) => {
  focusedPhotoId = photoId ? Number(photoId) : null;
  markerByPhotoId.forEach((marker, id) => {
    const element = marker.getElement();
    element?.classList.toggle('photo-marker-active', id === focusedPhotoId);
  });
};

const closePopupMode = () => {
  if (!map || props.showPopup) return;
  map.closePopup();
  mapEl.value?.querySelectorAll('.leaflet-popup').forEach((popup) => popup.remove());
};

const renderMarkers = () => {
  if (!map || isBaiduProvider.value) return;
  closePopupMode();
  markers.forEach((marker) => {
    marker.off();
    marker.unbindPopup();
    marker.remove();
  });
  markers = [];
  markerByPhotoId.clear();
  const bounds = [];
  props.photos
    .filter((photo) => photo.latitude && photo.longitude)
    .forEach((photo) => {
      const point = clampLatLng(photo.latitude, photo.longitude);
      const marker = L.marker(point, {
        icon: markerIcon,
        interactive: props.showPopup
      }).addTo(map);
      if (props.showPopup) {
        marker.bindPopup(`
          <a href="/photos/${photo.id}" class="map-popup" aria-label="查看照片 ${escapeHtml(photo.title)}">
            <img src="${escapeHtml(photoImageUrl(photo))}" alt="${escapeHtml(photo.title)}" />
            <strong>${escapeHtml(photo.title)}</strong>
            <span>${escapeHtml(photo.city || photo.locationName || '')} ${formatDate(photo.takenAt || photo.uploadedAt)}</span>
          </a>
        `, { closeButton: false, autoPan: false });
        bindHoverPopup(marker, photo);
      }
      markers.push(marker);
      markerByPhotoId.set(Number(photo.id), marker);
      bounds.push(point);
    });
  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: clampZoom(props.fitMaxZoom) });
    map.panInsideBounds(worldBounds, { animate: false });
  }
  setFocusedMarker(focusedPhotoId);
  closePopupMode();
};

const focusPhoto = async (photoOrId, zoomOverride = props.focusZoom) => {
  if (isBaiduProvider.value) {
    return baiduViewer.value?.focusPhoto?.(photoOrId, zoomOverride) || false;
  }
  const photoId = Number(typeof photoOrId === 'object' ? photoOrId?.id : photoOrId);
  if (!map || !Number.isFinite(photoId)) return false;
  await nextTick();
  const marker = markerByPhotoId.get(photoId);
  const photo = props.photos.find((item) => Number(item.id) === photoId);
  if (!marker || !photo?.latitude || !photo?.longitude) return false;

  setFocusedMarker(photoId);
  const targetZoom = clampZoom(zoomOverride, props.focusZoom);
  map.flyTo(clampLatLng(photo.latitude, photo.longitude), targetZoom, {
    animate: true,
    duration: 0.85
  });
  if (props.showPopup) {
    window.setTimeout(() => {
      marker.openPopup();
    }, 360);
  }
  return true;
};

const bindHoverPopup = (marker, photo) => {
  if (!props.showPopup) return;

  let closeTimer = null;
  let popupEl = null;

  const cancelClose = () => {
    if (!closeTimer) return;
    window.clearTimeout(closeTimer);
    closeTimer = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      marker.closePopup();
      closeTimer = null;
    }, 180);
  };

  const openDetail = (event) => {
    if (!event.target?.closest?.('.map-popup')) return;
    event.preventDefault();
    event.stopPropagation();
    cancelClose();
    emit('detail', photo);
  };

  const attachPopupHover = () => {
    if (!props.showPopup) return;
    const nextPopupEl = marker.getPopup()?.getElement();
    if (!nextPopupEl || nextPopupEl === popupEl) return;
    if (popupEl) {
      popupEl.removeEventListener('mouseenter', cancelClose);
      popupEl.removeEventListener('mouseleave', scheduleClose);
      popupEl.removeEventListener('click', openDetail);
    }
    popupEl = nextPopupEl;
    popupEl.addEventListener('mouseenter', cancelClose);
    popupEl.addEventListener('mouseleave', scheduleClose);
    popupEl.addEventListener('click', openDetail);
  };

  const cleanup = () => {
    cancelClose();
    if (!popupEl) return;
    popupEl.removeEventListener('mouseenter', cancelClose);
    popupEl.removeEventListener('mouseleave', scheduleClose);
    popupEl.removeEventListener('click', openDetail);
    popupEl = null;
  };

  marker.on('mouseover', () => {
    if (!props.showPopup) return;
    cancelClose();
    marker.openPopup();
  });
  marker.on('mouseout', () => {
    if (!props.showPopup) return;
    scheduleClose();
  });
  marker.on('click', () => {
    if (!props.showPopup) return;
    marker.openPopup();
  });
  marker.on('popupopen', attachPopupHover);
  marker.on('remove', cleanup);
};

const providerConfig = computed(() => getLeafletTileConfig(settings.settings, worldBounds));

const applyTileLayer = () => {
  if (!map || isBaiduProvider.value) return;
  tileErrorVisible.value = false;
  if (tileLayer) tileLayer.remove();
  const { url, options } = providerConfig.value;
  applyMapLimits();
  tileLayer = L.tileLayer(url, options)
    .on('tileerror', () => {
      tileErrorVisible.value = true;
    })
    .on('tileload', () => {
      tileErrorVisible.value = false;
    })
    .addTo(map);
};

const initLeafletMap = () => {
  if (map || isBaiduProvider.value || !mapEl.value) return;
  map = L.map(mapEl.value, {
    scrollWheelZoom: true,
    attributionControl: false,
    minZoom: MAP_MIN_ZOOM,
    maxBounds: worldBounds,
    maxBoundsViscosity: 1,
    worldCopyJump: false
  }).setView(clampLatLng(props.center?.[0], props.center?.[1]), clampZoom(props.zoom));
  attributionControl = L.control.attribution({ prefix: false }).addTo(map);
  applyMapLimits();
  applyTileLayer();
  renderMarkers();
  closePopupMode();
};

const destroyLeafletMap = () => {
  if (!map) return;
  map.remove();
  map = null;
  tileLayer = null;
  attributionControl = null;
  markers = [];
  markerByPhotoId.clear();
};

onMounted(initLeafletMap);

watch(() => props.photos, renderMarkers, { deep: true });
watch(() => props.fitMaxZoom, renderMarkers);
watch(() => props.height, async () => {
  await nextTick();
  map?.invalidateSize();
  map?.panInsideBounds(worldBounds, { animate: false });
});
watch(() => props.showPopup, () => {
  closePopupMode();
  renderMarkers();
});
watch(providerConfig, applyTileLayer);
watch(isBaiduProvider, async (enabled) => {
  if (enabled) {
    destroyLeafletMap();
    return;
  }
  await nextTick();
  initLeafletMap();
});

onBeforeUnmount(() => {
  destroyLeafletMap();
});

defineExpose({ focusPhoto });
</script>

<style>
.photo-marker span {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--theme-map-marker-fill);
  border: 3px solid var(--theme-map-marker-ring);
  box-shadow: var(--theme-map-marker-shadow);
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.photo-marker.photo-marker-active span {
  transform: scale(1.34);
  background: var(--theme-primary);
  border-color: var(--theme-map-marker-ring);
}

.map-shell .leaflet-tile {
  filter: var(--theme-map-tile-filter);
}

.map-shell .leaflet-control-zoom,
.map-shell .leaflet-bar {
  border: 1px solid var(--theme-map-control-border) !important;
  background: transparent !important;
  box-shadow: var(--theme-shadow) !important;
}

.map-shell .leaflet-control-zoom a,
.map-shell .leaflet-control-attribution,
.map-shell .leaflet-bar a {
  background: var(--theme-map-control-bg) !important;
  color: var(--theme-map-control-text) !important;
  border-color: var(--theme-map-control-border) !important;
}

.map-shell .leaflet-control-zoom a:hover,
.map-shell .leaflet-control-zoom a:focus,
.map-shell .leaflet-bar a:hover,
.map-shell .leaflet-bar a:focus {
  background: var(--theme-map-control-hover-bg) !important;
  color: var(--theme-map-control-hover-text) !important;
}

.map-shell .leaflet-popup-content-wrapper,
.map-shell .leaflet-popup-tip {
  background: var(--theme-map-popup-bg) !important;
  color: var(--theme-map-popup-text) !important;
  border: 1px solid var(--theme-map-popup-border) !important;
  box-shadow: var(--theme-map-popup-shadow) !important;
}

.map-shell .leaflet-popup-content {
  color: var(--theme-map-popup-text) !important;
}

.map-shell .leaflet-container a.map-popup,
.map-shell .map-popup {
  display: grid;
  gap: 6px;
  color: var(--theme-map-popup-text) !important;
  min-width: 160px;
  cursor: pointer;
}

.map-shell .map-popup img {
  width: 160px;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
}

.map-shell .map-popup strong {
  color: var(--theme-map-popup-text);
}

.map-shell .map-popup span {
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
  z-index: 500;
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
