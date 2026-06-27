<template>
  <section class="map-page">
    <aside class="map-sidebar">
      <div class="map-sidebar-head">
        <span>Photo Map</span>
        <strong>照片地图</strong>
      </div>

      <div class="map-filter-panel">
        <el-input v-model="filters.q" clearable placeholder="搜索照片标题" @keyup.enter="applyFilters" />
        <el-select v-model="filters.country" filterable clearable placeholder="国家 / 地区" @change="handleCountryChange">
          <el-option v-for="country in countries" :key="country.country" :label="`${country.country} (${country.count})`" :value="country.country" />
        </el-select>
        <el-select v-model="filters.city" filterable clearable placeholder="城市" @change="handleCityChange">
          <el-option v-for="city in cities" :key="`${city.country || 'unknown'}-${city.city}`" :label="`${city.city} (${city.count})`" :value="city.city" />
        </el-select>
        <el-select v-model="filters.year" clearable placeholder="年份" @change="applyFilters">
          <el-option v-for="item in years" :key="item.year" :label="`${item.year} (${item.count})`" :value="item.year" />
        </el-select>
        <el-button type="primary" @click="applyFilters">筛选</el-button>
      </div>

      <div class="map-list" aria-label="地图照片列表">
        <button
          v-for="photo in photos"
          :key="photo.id"
          class="map-photo-card"
          :class="{ active: selectedPhotoId === photo.id }"
          type="button"
          @click="focusPhoto(photo)"
        >
          <img :src="imageUrl(photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl)" :alt="photo.title" />
          <span class="map-photo-title">{{ photo.title }}</span>
          <span class="map-photo-meta">
            <span class="map-photo-place">{{ placeText(photo) }}</span>
            <span class="map-photo-date">{{ formatDate(photo.takenAt || photo.uploadedAt) }}</span>
          </span>
        </button>
        <div v-if="!photos.length" class="map-empty">没有找到带位置的照片</div>
      </div>
    </aside>

    <div ref="mapStageRef" class="map-stage">
      <MapViewer
        ref="mapViewerRef"
        :photos="photos"
        height="100%"
        :fit-max-zoom="mapPageZoom"
        :focus-zoom="mapPageZoom"
        @detail="openPhotoDetail"
      />
    </div>
  </section>

  <PhotoDetailSheet
    :visible="detailVisible"
    :photo-id="detailPhoto?.id || null"
    :initial-photo="detailPhoto"
    @close="detailVisible = false"
    @updated="syncPhoto"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '../../api/request.js';
import MapViewer from '../../components/map/MapViewer.vue';
import PhotoDetailSheet from '../../components/photo/PhotoDetailSheet.vue';
import { imageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';
import { mapSceneForPhoto, mapSceneForPhotos, mapZoomForScene } from '../../utils/map.js';
import { useSettingsStore } from '../../stores/settings.store.js';

const route = useRoute();
const settings = useSettingsStore();
const photos = ref([]);
const cities = ref([]);
const countries = ref([]);
const years = ref([]);
const selectedPhotoId = ref(null);
const mapViewerRef = ref(null);
const mapStageRef = ref(null);
const detailVisible = ref(false);
const detailPhoto = ref(null);
const filters = reactive({
  q: route.query.q || '',
  city: route.query.city || '',
  country: route.query.country || '',
  year: route.query.year ? Number(route.query.year) : ''
});

const mapScene = computed(() => mapSceneForPhotos(photos.value, filters.country));
const mapPageZoom = computed(() => mapZoomForScene(settings.settings, mapScene.value, 'page'));
let initialFocusTimer = null;
let initialFocusRequestId = 0;

const filterParams = () => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
);

const clearInitialFocus = () => {
  initialFocusRequestId += 1;
  if (initialFocusTimer) {
    window.clearTimeout(initialFocusTimer);
    initialFocusTimer = null;
  }
};

const hasLocation = (photo) => Number.isFinite(Number(photo?.latitude)) && Number.isFinite(Number(photo?.longitude));
const firstLocatedPhoto = () => photos.value.find(hasLocation) || photos.value[0];

const focusFirstLocatedPhoto = async (requestId, attempt = 0) => {
  const first = firstLocatedPhoto();
  if (!first || requestId !== initialFocusRequestId) return;
  selectedPhotoId.value = first.id;
  await nextTick();
  const photoZoom = mapZoomForScene(settings.settings, mapSceneForPhoto(first), 'detail');
  const focused = await mapViewerRef.value?.focusPhoto(first, photoZoom);
  if (!focused && requestId === initialFocusRequestId && selectedPhotoId.value === first.id && attempt < 10) {
    initialFocusTimer = window.setTimeout(() => focusFirstLocatedPhoto(requestId, attempt + 1), 180);
  }
};

const scheduleInitialFocus = () => {
  if (initialFocusTimer) window.clearTimeout(initialFocusTimer);
  initialFocusRequestId += 1;
  const requestId = initialFocusRequestId;
  initialFocusTimer = window.setTimeout(() => focusFirstLocatedPhoto(requestId), 80);
};

const load = async () => {
  const res = await request.get('/map/photos', { params: filterParams() });
  photos.value = Array.isArray(res.data) ? res.data : [];
  selectedPhotoId.value = null;
  scheduleInitialFocus();
};

const loadFilterOptions = async () => {
  const res = await request.get('/map/filter-options', { params: filterParams() });
  countries.value = res.data?.countries || [];
  cities.value = res.data?.cities || [];
  years.value = res.data?.years || [];

  let changed = false;
  if (filters.country && !countries.value.some((item) => item.country === filters.country)) {
    filters.country = '';
    filters.city = '';
    filters.year = '';
    changed = true;
  }
  if (filters.city && !cities.value.some((item) => item.city === filters.city)) {
    filters.city = '';
    filters.year = '';
    changed = true;
  }
  if (filters.year && !years.value.some((item) => Number(item.year) === Number(filters.year))) {
    filters.year = '';
    changed = true;
  }
  return changed;
};

const applyFilters = async () => {
  const changed = await loadFilterOptions();
  if (changed) await loadFilterOptions();
  await load();
};

const handleCountryChange = () => {
  filters.city = '';
  filters.year = '';
  applyFilters();
};

const handleCityChange = () => {
  filters.year = '';
  applyFilters();
};

const placeText = (photo) => {
  const parts = [photo.country, photo.city || photo.locationName].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return photo.locationName || '未填写地点';
};

const focusPhoto = (photo) => {
  clearInitialFocus();
  selectedPhotoId.value = photo.id;
  const photoZoom = mapZoomForScene(settings.settings, mapSceneForPhoto(photo), 'detail');
  return mapViewerRef.value?.focusPhoto(photo, photoZoom);
};

const openPhotoDetail = (photo) => {
  selectedPhotoId.value = photo.id;
  detailPhoto.value = photo;
  detailVisible.value = true;
};

const syncPhoto = (fresh) => {
  if (!fresh?.id) return;
  photos.value = photos.value.map((photo) => (photo.id === fresh.id ? { ...photo, ...fresh } : photo));
  if (detailPhoto.value?.id === fresh.id) detailPhoto.value = { ...detailPhoto.value, ...fresh };
};

onMounted(() => {
  applyFilters();
});

onBeforeUnmount(() => {
  clearInitialFocus();
});
</script>

<style scoped>
.map-page {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: clamp(292px, 22vw, 360px) minmax(0, 1fr);
  background: var(--theme-bg);
}

.map-sidebar {
  height: 100dvh;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  padding: 14px 10px 14px;
  border-right: 1px solid var(--theme-line);
  background: color-mix(in srgb, var(--theme-surface) 90%, var(--theme-bg));
}

.map-sidebar-head {
  display: grid;
  gap: 4px;
  padding: 4px 2px 2px;
}

.map-sidebar-head span {
  color: var(--theme-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.map-sidebar-head strong {
  color: var(--theme-text);
  font-size: 22px;
  line-height: 1.1;
}

.map-filter-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  background: var(--theme-surface-glass);
  box-shadow: var(--theme-shadow-soft, none);
}

.map-filter-panel :deep(.el-input),
.map-filter-panel :deep(.el-select),
.map-filter-panel :deep(.el-button) {
  width: 100%;
}

.map-list {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 2px 18px 0;
  scroll-padding-top: 6px;
  scrollbar-width: thin;
}

.map-photo-card {
  min-height: 92px;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  column-gap: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  color: var(--theme-text);
  background: var(--theme-surface-glass);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.map-photo-card:hover,
.map-photo-card:focus-visible,
.map-photo-card.active {
  border-color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--theme-surface-glass));
  box-shadow: var(--theme-shadow);
  outline: none;
}

.map-photo-card img {
  grid-row: 1 / 3;
  width: 92px;
  height: 92px;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--theme-image-skeleton-base);
}

.map-photo-title,
.map-photo-meta,
.map-photo-date,
.map-photo-place {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-photo-title {
  align-self: start;
  padding: 14px 12px 0;
  color: var(--theme-text);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
}

.map-photo-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10px;
  padding: 0 12px 13px;
  color: var(--theme-muted-strong);
  font-size: 12px;
  line-height: 1.2;
}

.map-photo-place {
  flex: 1 1 auto;
}

.map-photo-date {
  flex: 0 0 auto;
  color: var(--theme-muted);
}

.map-empty {
  padding: 18px;
  border: 1px dashed var(--theme-line);
  border-radius: var(--radius);
  color: var(--theme-muted-strong);
  background: var(--theme-surface-glass);
  text-align: center;
}

.map-stage {
  min-height: 100dvh;
  background: var(--theme-surface-soft);
}

.map-stage :deep(.map-shell) {
  height: 100% !important;
  min-height: 100dvh;
  border: 0;
  border-radius: 0;
}

@media (max-width: 900px) {
  .map-page {
    grid-template-columns: 1fr;
  }

  .map-sidebar {
    height: auto;
    max-height: none;
    border-right: 0;
    border-bottom: 1px solid var(--theme-line);
  }

  .map-list {
    max-height: 42dvh;
  }

  .map-stage,
  .map-stage :deep(.map-shell) {
    min-height: 58dvh;
  }
}
</style>
