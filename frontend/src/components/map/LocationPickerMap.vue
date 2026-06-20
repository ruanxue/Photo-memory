<template>
  <div class="location-picker">
    <div ref="mapEl" class="location-picker-map"></div>
    <div class="location-picker-hint">
      <strong>{{ selectedText }}</strong>
      <span>点击地图或拖动标记来选择拍摄地。</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import { useSettingsStore } from '../../stores/settings.store.js';

const props = defineProps({
  latitude: { type: [Number, String], default: '' },
  longitude: { type: [Number, String], default: '' },
  center: { type: Array, default: () => [30.67, 104.06] },
  zoom: { type: Number, default: 4 }
});

const emit = defineEmits(['select']);

const settings = useSettingsStore();
const mapEl = ref(null);
let map;
let marker;
let tileLayer;
let attributionControl;

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const currentPosition = computed(() => {
  const latitude = numberOrNull(props.latitude);
  const longitude = numberOrNull(props.longitude);
  if (latitude === null || longitude === null) return null;
  return [latitude, longitude];
});

const selectedText = computed(() => {
  const position = currentPosition.value;
  if (!position) return '尚未选择坐标';
  return `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`;
});

const markerIcon = L.divIcon({
  className: 'location-picker-marker',
  html: '<span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

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

const emitPosition = (latlng) => {
  emit('select', {
    latitude: Number(latlng.lat.toFixed(6)),
    longitude: Number(latlng.lng.toFixed(6))
  });
};

const placeMarker = (position, options = {}) => {
  if (!map || !position) return;
  if (!marker) {
    marker = L.marker(position, { icon: markerIcon, draggable: true }).addTo(map);
    marker.on('dragend', () => emitPosition(marker.getLatLng()));
  } else {
    marker.setLatLng(position);
  }
  if (options.pan !== false) {
    map.setView(position, Math.max(map.getZoom(), 12), { animate: true });
  }
};

const syncMarker = () => {
  if (!map) return;
  const position = currentPosition.value;
  if (position) {
    placeMarker(position, { pan: true });
  } else if (marker) {
    marker.remove();
    marker = null;
  }
};

const applyTileLayer = () => {
  if (!map) return;
  if (tileLayer) tileLayer.remove();
  const { url, options } = providerConfig.value;
  tileLayer = L.tileLayer(url, options).addTo(map);
};

const refresh = async () => {
  await nextTick();
  if (!map) return;
  map.invalidateSize();
  syncMarker();
};

onMounted(async () => {
  const start = currentPosition.value || props.center;
  map = L.map(mapEl.value, { scrollWheelZoom: true, attributionControl: false }).setView(start, currentPosition.value ? 12 : props.zoom);
  attributionControl = L.control.attribution({ prefix: false }).addTo(map);
  applyTileLayer();
  map.on('click', (event) => {
    emitPosition(event.latlng);
    placeMarker([event.latlng.lat, event.latlng.lng], { pan: false });
  });
  await refresh();
});

watch(currentPosition, syncMarker);
watch(providerConfig, applyTileLayer);

onBeforeUnmount(() => {
  if (map) map.remove();
});

defineExpose({ refresh });
</script>

<style>
.location-picker-marker span {
  display: block;
  width: 22px;
  height: 22px;
  border: 3px solid var(--theme-map-marker-ring);
  border-radius: 50%;
  background: var(--theme-primary);
  box-shadow: var(--theme-map-marker-shadow);
}

.location-picker .leaflet-tile {
  filter: var(--theme-map-tile-filter);
}

.location-picker .leaflet-control-zoom,
.location-picker .leaflet-bar {
  border: 1px solid var(--theme-map-control-border) !important;
  background: transparent !important;
  box-shadow: var(--theme-shadow) !important;
}

.location-picker .leaflet-control-zoom a,
.location-picker .leaflet-control-attribution,
.location-picker .leaflet-bar a {
  background: var(--theme-map-control-bg) !important;
  color: var(--theme-map-control-text) !important;
  border-color: var(--theme-map-control-border) !important;
}

.location-picker .leaflet-control-zoom a:hover,
.location-picker .leaflet-control-zoom a:focus,
.location-picker .leaflet-bar a:hover,
.location-picker .leaflet-bar a:focus {
  background: var(--theme-map-control-hover-bg) !important;
  color: var(--theme-map-control-hover-text) !important;
}
</style>

<style scoped>
.location-picker {
  position: relative;
  min-height: 420px;
  overflow: hidden;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  background: var(--theme-surface-soft);
}

.location-picker-map {
  width: 100%;
  height: 420px;
}

.location-picker-hint {
  position: absolute;
  left: 14px;
  bottom: 14px;
  z-index: 500;
  max-width: min(360px, calc(100% - 28px));
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  color: var(--theme-text);
  background: var(--theme-surface-glass);
  box-shadow: var(--theme-shadow);
  backdrop-filter: blur(12px);
}

.location-picker-hint strong {
  font-size: 13px;
}

.location-picker-hint span {
  color: var(--theme-muted-strong);
  font-size: 12px;
}
</style>
