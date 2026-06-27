<template>
  <div class="location-picker baidu-location-picker">
    <div class="location-picker-tools">
      <el-input v-model="searchKeyword" clearable placeholder="百度地点检索" @keyup.enter="searchPlace">
        <template #append>
          <el-button :loading="searching" @click="searchPlace">搜索</el-button>
        </template>
      </el-input>
      <el-select v-model="selectedLocationKey" filterable clearable placeholder="搜索已有地点" @change="selectLocationByKey">
        <el-option v-for="item in locationOptions" :key="item.key" :label="item.label" :value="item.key" />
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
      <span>{{ errorMessage || '点击地图或拖动标记来选择拍摄地。' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import request from '../../api/request.js';
import { mapApi } from '../../api/map.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { isChinaCountry, mapZoomForScene } from '../../utils/map.js';
import {
  baiduPointToWgs84LatLng,
  clampBaiduZoom,
  loadBaiduMapGL,
  toBaiduPoint
} from '../../map/adapters/baidu.js';

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
const existingPhotos = ref([]);
const selectedLocationKey = ref('');
const searchKeyword = ref('');
const searching = ref(false);
const filters = reactive({ country: '', city: '' });
const errorMessage = ref('');
let BMapGL;
let map;
let marker;

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clampZoom = (zoom, fallback = props.zoom) => {
  return clampBaiduZoom(zoom, fallback);
};

const toBdPoint = (latitude, longitude) => {
  return toBaiduPoint(BMapGL, latitude, longitude, props.center);
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
    const current = groups.get(key) || { key, name, country: item.country, city: item.city, count: 0, latitudeTotal: 0, longitudeTotal: 0 };
    current.count += 1;
    current.latitudeTotal += item.latitude;
    current.longitudeTotal += item.longitude;
    groups.set(key, current);
  });
  return [...groups.values()]
    .map((item) => ({ ...item, latitude: item.latitudeTotal / item.count, longitude: item.longitudeTotal / item.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
};

const countryOptions = computed(() => makeGroup(locationPhotos.value, (item) => item.country, (item) => item.country)
  .map((item) => ({ ...item, country: item.name, city: '' })));

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
    label: [item.locationName || item.title || item.city, item.city, item.country].filter(Boolean).join(' · ')
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN')));

const emitBdPoint = (point, meta = {}) => {
  const [safeLat, safeLng] = baiduPointToWgs84LatLng(point, props.center);
  emit('select', {
    latitude: Number(safeLat.toFixed(6)),
    longitude: Number(safeLng.toFixed(6)),
    ...meta
  });
};

const ensureMarker = (point, options = {}) => {
  if (!map || !BMapGL || !point) return;
  if (!marker) {
    marker = new BMapGL.Marker(point, { enableDragging: true });
    marker.addEventListener('dragend', (event) => emitBdPoint(event.latLng || marker.getPosition()));
    map.addOverlay(marker);
  } else {
    marker.setPosition(point);
  }
  if (options.pan !== false) {
    map.centerAndZoom(point, clampZoom(Math.max(map.getZoom(), detailZoom.value), detailZoom.value));
  }
};

const syncMarker = () => {
  if (!map) return;
  const position = currentPosition.value;
  if (position) ensureMarker(toBdPoint(position[0], position[1]), { pan: true });
  else if (marker) {
    map.removeOverlay(marker);
    marker = null;
  }
};

const focusLocation = (item, zoom = null, shouldEmit = true) => {
  if (!item || !map) return;
  const point = toBdPoint(item.latitude, item.longitude);
  map.centerAndZoom(point, clampZoom(zoom === null ? detailZoomForCountry(item.country) : zoom));
  ensureMarker(point, { pan: false });
  if (shouldEmit) emitBdPoint(point, { country: item.country || '', city: item.city || '', locationName: item.locationName || '' });
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

const searchPlace = async () => {
  const keyword = searchKeyword.value.trim();
  if (!keyword || !BMapGL || !map) return;
  searching.value = true;
  errorMessage.value = '';
  try {
    const res = await mapApi.places({
      q: keyword,
      country: filters.country || props.country || '',
      city: filters.city || '',
      lat: currentPosition.value?.[0],
      lng: currentPosition.value?.[1]
    });
    const place = res.data?.[0];
    if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) {
      errorMessage.value = '没有找到匹配地点，可以换一个关键词试试。';
      return;
    }
    const point = toBdPoint(place.latitude, place.longitude);
    const country = place.country || filters.country || props.country || '';
    const city = place.city || filters.city || '';
    map.centerAndZoom(point, clampZoom(detailZoomForCountry(country), detailZoom.value));
    ensureMarker(point, { pan: false });
    emitBdPoint(point, {
      country,
      province: place.province || '',
      city,
      district: place.district || '',
      locationName: place.locationName || place.name || keyword
    });
  } catch (error) {
    errorMessage.value = error.response?.data?.message || '地点检索暂时不可用，可以继续手动点选地图。';
  } finally {
    searching.value = false;
  }
};

const refresh = async () => {
  await nextTick();
  map?.checkResize?.();
  syncMarker();
};

const init = async () => {
  try {
    errorMessage.value = '';
    BMapGL = await loadBaiduMapGL(settings.settings.baiduMapWebAk);
    const start = currentPosition.value || props.center;
    const point = toBdPoint(start[0], start[1]);
    map = new BMapGL.Map(mapEl.value, { enableMapClick: false, minZoom: 3, maxZoom: 19 });
    map.centerAndZoom(point, clampZoom(detailZoom.value, props.zoom));
    map.enableScrollWheelZoom(true);
    map.addControl(new BMapGL.ZoomControl());
    map.addEventListener('click', (event) => {
      emitBdPoint(event.latLng);
      ensureMarker(event.latLng, { pan: false });
    });
    request.get('/map/photos').then((res) => { existingPhotos.value = res.data || []; }).catch(() => { existingPhotos.value = []; });
    await refresh();
  } catch (error) {
    errorMessage.value = error.message || '请检查百度地图 Web 端 AK。';
  }
};

onMounted(init);
watch(currentPosition, syncMarker);
watch(detailZoom, () => {
  if (!map || !currentPosition.value) return;
  map.setZoom(clampZoom(detailZoom.value));
});
watch(() => settings.settings.baiduMapWebAk, () => {
  map?.destroy?.();
  map = null;
  marker = null;
  init();
});

onBeforeUnmount(() => {
  map?.destroy?.();
});

defineExpose({ refresh });
</script>

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
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(190px, 1.4fr) minmax(170px, 1.1fr) repeat(2, minmax(120px, 0.8fr)) auto;
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
  z-index: 20;
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
