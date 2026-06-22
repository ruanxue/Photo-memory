<template>
  <BaiduLocationPickerMap
    v-if="isBaiduProvider"
    ref="baiduPicker"
    :latitude="latitude"
    :longitude="longitude"
    :country="country"
    :center="center"
    :zoom="zoom"
    @select="emit('select', $event)"
  />
  <div v-else class="location-picker">
    <div class="location-picker-tools">
      <el-select
        v-model="selectedLocationKey"
        filterable
        clearable
        placeholder="搜索已有地点"
        @change="selectLocationByKey"
      >
        <el-option
          v-for="item in locationOptions"
          :key="item.key"
          :label="item.label"
          :value="item.key"
        />
      </el-select>
      <el-select v-model="filters.country" filterable clearable placeholder="国家 / 地区" @change="handleCountryChange">
        <el-option v-for="item in countryOptions" :key="item.name" :label="`${item.name} (${item.count})`" :value="item.name" />
      </el-select>
      <el-select v-model="filters.city" filterable clearable placeholder="城市" @change="focusSelectedArea">
        <el-option v-for="item in cityOptions" :key="`${item.country}-${item.name}`" :label="`${item.name} (${item.count})`" :value="item.name" />
      </el-select>
      <el-button @click="focusSelectedArea">定位</el-button>
    </div>
    <div ref="mapEl" class="location-picker-map"></div>
    <div class="location-picker-hint">
      <strong>{{ selectedText }}</strong>
      <span>点击地图或拖动标记来选择拍摄地。</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import L from 'leaflet';
import request from '../../api/request.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { isChinaCountry, mapZoomForScene } from '../../utils/map.js';
import BaiduLocationPickerMap from './BaiduLocationPickerMap.vue';

const props = defineProps({
  latitude: { type: [Number, String], default: '' },
  longitude: { type: [Number, String], default: '' },
  country: { type: String, default: '' },
  center: { type: Array, default: () => [30.67, 104.06] },
  zoom: { type: Number, default: 4 }
});

const emit = defineEmits(['select']);

const settings = useSettingsStore();
const mapEl = ref(null);
const baiduPicker = ref(null);
const existingPhotos = ref([]);
const selectedLocationKey = ref('');
const filters = reactive({ country: '', city: '' });
let map;
let marker;
let tileLayer;
let attributionControl;
const minMapZoom = 3;
const isBaiduProvider = computed(() => settings.settings.mapTileProvider === 'baidu');
const worldBounds = L.latLngBounds(
  L.latLng(-85.05112878, -180),
  L.latLng(85.05112878, 180)
);

const clampZoom = (zoom, fallback = props.zoom) => {
  const value = Number(zoom);
  const maxZoom = Number(providerConfig.value?.options?.maxZoom) || 18;
  if (!Number.isFinite(value)) return Math.max(minMapZoom, Math.min(maxZoom, Number(fallback) || minMapZoom));
  return Math.max(minMapZoom, Math.min(maxZoom, value));
};

const clampLatLng = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return [
    Math.max(-85.05112878, Math.min(85.05112878, Number.isFinite(lat) ? lat : props.center[0])),
    Math.max(-180, Math.min(180, Number.isFinite(lng) ? lng : props.center[1]))
  ];
};

const applyMapLimits = () => {
  if (!map) return;
  map.setMinZoom(minMapZoom);
  map.setMaxZoom(Number(providerConfig.value.options.maxZoom) || 18);
  map.setMaxBounds(worldBounds);
  map.options.maxBoundsViscosity = 1;
  map.panInsideBounds(worldBounds, { animate: false });
};

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

const activeCountry = computed(() => filters.country || props.country || '');
const detailZoom = computed(() => mapZoomForScene(
  settings.settings,
  activeCountry.value && !isChinaCountry(activeCountry.value) ? 'overseas' : 'china',
  'detail'
));
const detailZoomForCountry = (country = '') => mapZoomForScene(
  settings.settings,
  country && !isChinaCountry(country) ? 'overseas' : 'china',
  'detail'
);

const locationPhotos = computed(() => existingPhotos.value
  .filter((photo) => Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude)))
  .map((photo) => ({
    id: photo.id,
    country: String(photo.country || '').trim(),
    city: String(photo.city || '').trim(),
    locationName: String(photo.locationName || '').trim(),
    title: String(photo.title || '').trim(),
    latitude: Number(photo.latitude),
    longitude: Number(photo.longitude)
  })));

const makeGroup = (items, keySelector, nameSelector) => {
  const groups = new Map();
  items.forEach((item) => {
    const name = nameSelector(item);
    if (!name) return;
    const key = keySelector(item);
    const current = groups.get(key) || {
      key,
      name,
      country: item.country,
      city: item.city,
      count: 0,
      latitudeTotal: 0,
      longitudeTotal: 0
    };
    current.count += 1;
    current.latitudeTotal += item.latitude;
    current.longitudeTotal += item.longitude;
    groups.set(key, current);
  });
  return [...groups.values()]
    .map((item) => ({
      ...item,
      latitude: item.latitudeTotal / item.count,
      longitude: item.longitudeTotal / item.count
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
};

const countryOptions = computed(() => makeGroup(
  locationPhotos.value,
  (item) => item.country,
  (item) => item.country
).map((item) => ({ ...item, country: item.name, city: '' })));

const cityOptions = computed(() => makeGroup(
  locationPhotos.value.filter((item) => !filters.country || item.country === filters.country),
  (item) => `${item.country}::${item.city}`,
  (item) => item.city
));

const locationOptions = computed(() => locationPhotos.value
  .filter((item) => item.locationName || item.city || item.title)
  .map((item) => ({
    ...item,
    key: String(item.id),
    label: [
      item.locationName || item.title || item.city,
      item.city,
      item.country
    ].filter(Boolean).join(' · ')
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN')));

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
        minZoom: minMapZoom,
        noWrap: true,
        bounds: worldBounds,
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
        minZoom: minMapZoom,
        noWrap: true,
        bounds: worldBounds,
        maxZoom: 20
      }
    };
  }

  return {
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['1', '2', '3', '4'],
      attribution: settings.settings.mapTileAttribution || '© 高德地图',
      minZoom: minMapZoom,
      noWrap: true,
      bounds: worldBounds,
      maxZoom: 18
    }
  };
});

const emitPosition = (latlng, meta = {}) => {
  const point = clampLatLng(latlng.lat, latlng.lng);
  emit('select', {
    latitude: Number(point[0].toFixed(6)),
    longitude: Number(point[1].toFixed(6)),
    ...meta
  });
};

const placeMarker = (position, options = {}) => {
  if (!map || !position) return;
  const point = clampLatLng(position[0], position[1]);
  if (!marker) {
    marker = L.marker(point, { icon: markerIcon, draggable: true }).addTo(map);
    marker.on('dragend', () => emitPosition(marker.getLatLng()));
  } else {
    marker.setLatLng(point);
  }
  if (options.pan !== false) {
    map.setView(point, clampZoom(Math.max(map.getZoom(), detailZoom.value)), { animate: true });
  }
  map.panInsideBounds(worldBounds, { animate: false });
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
  applyMapLimits();
  tileLayer = L.tileLayer(url, options).addTo(map);
};

const focusLocation = (item, zoom = 12, shouldEmit = true) => {
  if (!item || !map) return;
  const point = clampLatLng(item.latitude, item.longitude);
  const targetZoom = zoom === null ? detailZoomForCountry(item.country) : zoom;
  map.flyTo(point, clampZoom(targetZoom, detailZoomForCountry(item.country)), { animate: true, duration: 0.72 });
  placeMarker(point, { pan: false });
  if (shouldEmit) {
    emitPosition({ lat: point[0], lng: point[1] }, {
      country: item.country || '',
      city: item.city || '',
      locationName: item.locationName || ''
    });
  }
};

const selectLocationByKey = (key) => {
  const item = locationOptions.value.find((option) => option.key === key);
  if (!item) return;
  filters.country = item.country || '';
  filters.city = item.city || '';
  focusLocation(item, null, true);
};

const handleCountryChange = () => {
  filters.city = '';
  selectedLocationKey.value = '';
  focusSelectedArea();
};

const focusSelectedArea = () => {
  selectedLocationKey.value = '';
  const city = cityOptions.value.find((item) => item.name === filters.city);
  if (city) {
    focusLocation(city, null, true);
    return;
  }
  const country = countryOptions.value.find((item) => item.name === filters.country);
  if (country) focusLocation(country, null, true);
};

const refresh = async () => {
  if (isBaiduProvider.value) {
    await baiduPicker.value?.refresh?.();
    return;
  }
  await nextTick();
  if (!map) return;
  map.invalidateSize();
  map.panInsideBounds(worldBounds, { animate: false });
  syncMarker();
};

const initLeafletPicker = async () => {
  if (map || isBaiduProvider.value || !mapEl.value) return;
  const start = currentPosition.value || props.center;
  map = L.map(mapEl.value, {
    scrollWheelZoom: true,
    attributionControl: false,
    minZoom: minMapZoom,
    maxBounds: worldBounds,
    maxBoundsViscosity: 1,
    worldCopyJump: false
  }).setView(clampLatLng(start[0], start[1]), currentPosition.value ? detailZoom.value : clampZoom(detailZoom.value, props.zoom));
  attributionControl = L.control.attribution({ prefix: false }).addTo(map);
  applyMapLimits();
  applyTileLayer();
  map.on('click', (event) => {
    emitPosition(event.latlng);
    placeMarker([event.latlng.lat, event.latlng.lng], { pan: false });
  });
  request.get('/map/photos')
    .then((res) => { existingPhotos.value = res.data || []; })
    .catch(() => { existingPhotos.value = []; });
  await refresh();
};

const destroyLeafletPicker = () => {
  if (!map) return;
  map.remove();
  map = null;
  marker = null;
  tileLayer = null;
  attributionControl = null;
};

onMounted(initLeafletPicker);

watch(currentPosition, syncMarker);
watch(detailZoom, () => {
  if (!map || !currentPosition.value) return;
  map.setZoom(clampZoom(detailZoom.value), { animate: true });
});
watch(providerConfig, applyTileLayer);
watch(isBaiduProvider, async (enabled) => {
  if (enabled) {
    destroyLeafletPicker();
    return;
  }
  await nextTick();
  await initLeafletPicker();
});

onBeforeUnmount(() => {
  destroyLeafletPicker();
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

.location-picker-tools {
  position: absolute;
  top: 12px;
  right: 12px;
  left: 52px;
  z-index: 500;
  display: grid;
  grid-template-columns: minmax(180px, 1.35fr) repeat(2, minmax(120px, 0.8fr)) auto;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--theme-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-overlay) 88%, transparent);
  box-shadow: var(--theme-shadow);
  backdrop-filter: blur(14px);
}

.location-picker-tools :deep(.el-select) {
  width: 100%;
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

@media (max-width: 760px) {
  .location-picker-tools {
    right: 10px;
    left: 10px;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
