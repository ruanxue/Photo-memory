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
import { createPhotoClusters } from '../../utils/photoCluster.js';
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
const clusterRadius = 78;
const maxClusterZoom = 15;

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

const popupContent = (photo) => `
  <a href="/photos/${photo.id}" class="map-popup" aria-label="鏌ョ湅鐓х墖 ${escapeHtml(photo.title)}">
    <img src="${escapeHtml(photoImageUrl(photo))}" alt="${escapeHtml(photo.title)}" />
    <strong>${escapeHtml(photo.title)}</strong>
    <span>${escapeHtml(photo.city || photo.locationName || '')} ${formatDate(photo.takenAt || photo.uploadedAt)}</span>
  </a>
`;

const photoClusterIcon = (cluster, active = false) => {
  const photo = cluster.coverPhoto;
  const title = escapeHtml(photo?.title || '');
  const count = cluster.count > 99 ? '99+' : String(cluster.count);
  const meta = escapeHtml([photo?.city || photo?.locationName, formatDate(photo?.takenAt || photo?.uploadedAt)].filter(Boolean).join(' · '));
  return L.divIcon({
    className: [
      'photo-cluster-marker',
      'photo-cluster-marker-card',
      cluster.count === 1 ? 'photo-cluster-marker-single' : '',
      active ? 'photo-cluster-marker-active' : ''
    ].filter(Boolean).join(' '),
    html: `
      <article class="photo-cluster-card" aria-label="${title} ${count} 张照片">
        <img src="${escapeHtml(photoImageUrl(photo))}" alt="${title}" />
        <span class="photo-cluster-card-body">
          <strong>${title}</strong>
          <span class="photo-cluster-card-meta">
            <em>${meta}</em>
            <b>${count} 张</b>
          </span>
        </span>
      </article>
    `,
    iconSize: [184, 146],
    iconAnchor: [92, 142]
  });
};

const openLeafletPopupAt = (photo, point) => {
  if (!map || !props.showPopup) return;
  const popup = L.popup({ closeButton: false, autoPan: false })
    .setLatLng(point)
    .setContent(popupContent(photo))
    .openOn(map);
  window.setTimeout(() => {
    const popupEl = popup.getElement();
    popupEl?.addEventListener('click', (event) => {
      if (!event.target?.closest?.('.map-popup')) return;
      event.preventDefault();
      event.stopPropagation();
      emit('detail', photo);
    });
  }, 0);
};

const setFocusedMarker = (photoId) => {
  focusedPhotoId = photoId ? Number(photoId) : null;
  markerByPhotoId.forEach((marker, id) => {
    const element = marker.getElement();
    element?.classList.toggle('photo-marker-active', id === focusedPhotoId);
    element?.classList.toggle('photo-cluster-marker-active', id === focusedPhotoId);
  });
};

const closePopupMode = () => {
  if (!map) return;
  map.closePopup();
  mapEl.value?.querySelectorAll('.leaflet-popup').forEach((popup) => popup.remove());
};

const isClusterNearFocusedPhoto = (point) => {
  if (!focusedPhotoId || !map) return false;
  const focusedPhoto = props.photos.find((photo) => Number(photo.id) === Number(focusedPhotoId));
  if (!focusedPhoto?.latitude || !focusedPhoto?.longitude) return false;
  const focusedPoint = clampLatLng(focusedPhoto.latitude, focusedPhoto.longitude);
  const focusedPixel = map.latLngToContainerPoint(focusedPoint);
  const clusterPixel = map.latLngToContainerPoint(point);
  const dx = Math.abs(clusterPixel.x - focusedPixel.x);
  const dy = Math.abs(clusterPixel.y - focusedPixel.y);
  return dx < 190 && dy < 150;
};

const renderMarkers = ({ fit = true } = {}) => {
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
  const locatedPhotos = props.photos
    .filter((photo) => photo.latitude && photo.longitude)
    .map((photo) => ({ ...photo, __point: clampLatLng(photo.latitude, photo.longitude) }));

  locatedPhotos.forEach((photo) => bounds.push(photo.__point));

  const clusters = createPhotoClusters(locatedPhotos, {
    radius: clusterRadius,
    zoom: map.getZoom(),
    maxClusterZoom,
    focusedPhotoId,
    project: (photo) => {
      const point = map.latLngToContainerPoint(photo.__point || clampLatLng(photo.latitude, photo.longitude));
      return { x: point.x, y: point.y };
    }
  });

  clusters.forEach((cluster) => {
    const clusterPoint = clampLatLng(cluster.latitude, cluster.longitude);
    if (props.showPopup) {
      const hasFocusedPhoto = cluster.photos.some((photo) => Number(photo.id) === Number(focusedPhotoId));
      if (focusedPhotoId && !hasFocusedPhoto && isClusterNearFocusedPhoto(clusterPoint)) return;
      const marker = L.marker(clusterPoint, {
        icon: photoClusterIcon(cluster, hasFocusedPhoto),
        interactive: props.showPopup,
        zIndexOffset: 500
      }).addTo(map);
      marker.on('click', () => {
        if (cluster.count === 1) {
          emit('detail', cluster.coverPhoto);
          return;
        }
          map.flyTo(clusterPoint, clampZoom(Math.max(map.getZoom() + 2, props.focusZoom - 1), props.focusZoom), {
            animate: true,
            duration: 0.55
          });
      });
      markers.push(marker);
      if (cluster.count === 1) markerByPhotoId.set(Number(cluster.coverPhoto.id), marker);
      return;
    }

    const photo = cluster.coverPhoto;
    const point = photo.__point || clampLatLng(photo.latitude, photo.longitude);
    const marker = L.marker(point, {
      icon: markerIcon,
      interactive: props.showPopup
    }).addTo(map);
    if (props.showPopup) {
      marker.bindPopup(popupContent(photo), { closeButton: false, autoPan: false });
      bindHoverPopup(marker, photo);
    }
    markers.push(marker);
    markerByPhotoId.set(Number(photo.id), marker);
    });
  if (fit && bounds.length) {
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
  const photo = props.photos.find((item) => Number(item.id) === photoId);
  if (!photo?.latitude || !photo?.longitude) return false;

  setFocusedMarker(photoId);
  const point = clampLatLng(photo.latitude, photo.longitude);
  const targetZoom = clampZoom(zoomOverride, props.focusZoom);
  map.flyTo(point, targetZoom, {
    animate: true,
    duration: 0.85
  });
  renderMarkers({ fit: false });
  window.setTimeout(() => renderMarkers({ fit: false }), 380);
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
  attributionControl = L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);
  applyMapLimits();
  applyTileLayer();
  map.on('zoomend moveend', () => renderMarkers({ fit: false }));
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

.photo-cluster-marker {
  background: transparent;
  border: 0;
}

.photo-cluster-marker:hover,
.photo-cluster-marker-active {
  z-index: 900 !important;
}

.photo-cluster-marker-card {
  width: 184px !important;
  height: 146px !important;
}

.photo-cluster-card {
  position: relative;
  display: grid;
  gap: 7px;
  width: 176px;
  padding: 10px;
  border: 1px solid var(--theme-map-popup-border);
  border-radius: 13px;
  color: var(--theme-map-popup-text);
  background: var(--theme-map-popup-bg);
  box-shadow: var(--theme-map-popup-shadow);
  backdrop-filter: blur(12px);
  transform-origin: 50% 100%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.photo-cluster-card::after {
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

.photo-cluster-card img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 88px;
  border-radius: 8px;
  object-fit: cover;
}

.photo-cluster-card-body {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.photo-cluster-card strong {
  overflow: hidden;
  color: var(--theme-map-popup-text);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-cluster-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.photo-cluster-card em {
  overflow: hidden;
  color: var(--theme-map-popup-muted);
  font-size: 12px;
  font-style: normal;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-cluster-card b {
  flex: 0 0 auto;
  min-width: 34px;
  display: inline-grid;
  place-items: center;
  padding: 4px 7px;
  border-radius: 999px;
  color: var(--theme-button-primary-text);
  background: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.photo-cluster-marker:hover .photo-cluster-card,
.photo-cluster-marker-active .photo-cluster-card {
  border-color: var(--theme-primary);
  transform: translateY(-2px) scale(1.04);
  box-shadow: var(--theme-shadow-strong, var(--theme-map-marker-shadow));
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

.map-shell .leaflet-control-attribution {
  max-width: min(56vw, 720px);
  padding: 4px 8px !important;
  border: 1px solid var(--theme-map-control-border) !important;
  border-radius: 999px;
  box-shadow: var(--theme-shadow-soft, none);
  line-height: 1.45;
  white-space: normal;
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
