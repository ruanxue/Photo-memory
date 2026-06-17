<template>
  <div class="map-shell" :style="{ height }">
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
import { imageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';
import { useSettingsStore } from '../../stores/settings.store.js';

const props = defineProps({
  photos: { type: Array, default: () => [] },
  center: { type: Array, default: () => [30.67, 104.06] },
  zoom: { type: Number, default: 4 },
  height: { type: String, default: '520px' }
});

const emit = defineEmits(['detail']);
const mapEl = ref(null);
const settings = useSettingsStore();
const tileErrorVisible = ref(false);
let map;
let tileLayer;
let attributionControl;
let markers = [];
const markerByPhotoId = new Map();
let focusedPhotoId = null;

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

const renderMarkers = () => {
  if (!map) return;
  markers.forEach((marker) => marker.remove());
  markers = [];
  markerByPhotoId.clear();
  const bounds = [];
  props.photos
    .filter((photo) => photo.latitude && photo.longitude)
    .forEach((photo) => {
      const marker = L.marker([photo.latitude, photo.longitude], { icon: markerIcon }).addTo(map);
      marker.bindPopup(`
        <a href="/photos/${photo.id}" class="map-popup" aria-label="查看照片 ${escapeHtml(photo.title)}">
          <img src="${escapeHtml(imageUrl(photo.thumbnailUrl))}" alt="${escapeHtml(photo.title)}" />
          <strong>${escapeHtml(photo.title)}</strong>
          <span>${escapeHtml(photo.city || photo.locationName || '')} ${formatDate(photo.takenAt || photo.uploadedAt)}</span>
        </a>
      `, { closeButton: false, autoPan: false });
      bindHoverPopup(marker, photo);
      markers.push(marker);
      markerByPhotoId.set(Number(photo.id), marker);
      bounds.push([photo.latitude, photo.longitude]);
    });
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  setFocusedMarker(focusedPhotoId);
};

const focusPhoto = async (photoOrId) => {
  const photoId = Number(typeof photoOrId === 'object' ? photoOrId?.id : photoOrId);
  if (!map || !Number.isFinite(photoId)) return false;
  await nextTick();
  const marker = markerByPhotoId.get(photoId);
  const photo = props.photos.find((item) => Number(item.id) === photoId);
  if (!marker || !photo?.latitude || !photo?.longitude) return false;

  setFocusedMarker(photoId);
  map.flyTo([Number(photo.latitude), Number(photo.longitude)], Math.max(map.getZoom(), 14), {
    animate: true,
    duration: 0.85
  });
  window.setTimeout(() => {
    marker.openPopup();
  }, 360);
  return true;
};

const bindHoverPopup = (marker, photo) => {
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
    cancelClose();
    marker.openPopup();
  });
  marker.on('mouseout', scheduleClose);
  marker.on('click', () => marker.openPopup());
  marker.on('popupopen', attachPopupHover);
  marker.on('remove', cleanup);
};

const providerConfig = computed(() => {
  const provider = settings.settings.mapTileProvider || 'amap';
  if (provider === 'osm') {
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        subdomains: ['a', 'b', 'c'],
        attribution: settings.settings.mapTileAttribution || '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    };
  }

  if (provider === 'custom' && settings.settings.mapTileUrl) {
    return {
      url: settings.settings.mapTileUrl,
      options: {
        subdomains: ['a', 'b', 'c', '1', '2', '3', '4'],
        attribution: settings.settings.mapTileAttribution || '',
        maxZoom: 20
      }
    };
  }

  return {
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['1', '2', '3', '4'],
      attribution: settings.settings.mapTileAttribution || '© 高德地图',
      maxZoom: 18
    }
  };
});

const applyTileLayer = () => {
  if (!map) return;
  tileErrorVisible.value = false;
  if (tileLayer) tileLayer.remove();
  const { url, options } = providerConfig.value;
  tileLayer = L.tileLayer(url, options)
    .on('tileerror', () => {
      tileErrorVisible.value = true;
    })
    .on('tileload', () => {
      tileErrorVisible.value = false;
    })
    .addTo(map);
};

onMounted(() => {
  map = L.map(mapEl.value, { scrollWheelZoom: true, attributionControl: false }).setView(props.center, props.zoom);
  attributionControl = L.control.attribution({ prefix: false }).addTo(map);
  applyTileLayer();
  renderMarkers();
});

watch(() => props.photos, renderMarkers, { deep: true });
watch(providerConfig, applyTileLayer);

onBeforeUnmount(() => {
  if (map) map.remove();
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
