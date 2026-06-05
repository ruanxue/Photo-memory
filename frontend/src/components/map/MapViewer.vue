<template>
  <div class="map-shell" :style="{ height }" ref="mapEl"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import { imageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';

const props = defineProps({
  photos: { type: Array, default: () => [] },
  center: { type: Array, default: () => [30.67, 104.06] },
  zoom: { type: Number, default: 4 },
  height: { type: String, default: '520px' }
});

const mapEl = ref(null);
let map;
let markers = [];

const markerIcon = L.divIcon({
  className: 'photo-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const renderMarkers = () => {
  if (!map) return;
  markers.forEach((marker) => marker.remove());
  markers = [];
  const bounds = [];
  props.photos
    .filter((photo) => photo.latitude && photo.longitude)
    .forEach((photo) => {
      const marker = L.marker([photo.latitude, photo.longitude], { icon: markerIcon }).addTo(map);
      marker.bindPopup(`
        <a href="/photos/${photo.id}" class="map-popup">
          <img src="${imageUrl(photo.thumbnailUrl)}" alt="${photo.title}" />
          <strong>${photo.title}</strong>
          <span>${photo.city || photo.locationName || ''} ${formatDate(photo.takenAt || photo.uploadedAt)}</span>
        </a>
      `);
      markers.push(marker);
      bounds.push([photo.latitude, photo.longitude]);
    });
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
};

onMounted(() => {
  map = L.map(mapEl.value, { scrollWheelZoom: true }).setView(props.center, props.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  renderMarkers();
});

watch(() => props.photos, renderMarkers, { deep: true });

onBeforeUnmount(() => {
  if (map) map.remove();
});
</script>

<style>
.photo-marker span {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid #fff;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
}

.leaflet-tile {
  filter: brightness(0.66) contrast(1.18) saturate(0.78);
}

.leaflet-control-zoom a,
.leaflet-control-attribution {
  background: #121619 !important;
  color: var(--text-soft) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
  background: #121619;
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: var(--shadow);
}

.map-popup {
  display: grid;
  gap: 6px;
  color: var(--text);
  min-width: 160px;
}

.map-popup img {
  width: 160px;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
}

.map-popup span {
  color: var(--muted-strong);
  font-size: 12px;
}
</style>

<style scoped>
.map-shell {
  width: 100%;
  min-height: 260px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-soft);
}
</style>
