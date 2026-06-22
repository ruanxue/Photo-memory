<template>
  <section class="page-hero container">
    <h1>照片地图</h1>
    <p>只显示带 GPS 经纬度或手动填写过位置的照片，在地图上重走那些路。</p>
  </section>
  <section class="section">
    <div class="container">
      <div class="toolbar surface">
        <el-input v-model="filters.q" clearable placeholder="搜索图片标题" @keyup.enter="load" />
        <el-select v-model="filters.country" filterable clearable placeholder="国家 / 地区" @change="handleCountryChange">
          <el-option v-for="country in countries" :key="country.country" :label="`${country.country} (${country.count})`" :value="country.country" />
        </el-select>
        <el-select v-model="filters.city" filterable clearable placeholder="城市" @change="load">
          <el-option v-for="city in filteredCities" :key="`${city.country || 'unknown'}-${city.city}`" :label="`${city.city} (${city.count})`" :value="city.city" />
        </el-select>
        <el-select v-model="filters.year" clearable placeholder="年份" @change="load">
          <el-option v-for="item in years" :key="item.year" :label="`${item.year} (${item.count})`" :value="item.year" />
        </el-select>
        <el-button type="primary" @click="load">筛选</el-button>
      </div>
      <div ref="mapStageRef" class="map-stage">
        <MapViewer
          ref="mapViewerRef"
          :photos="photos"
          height="clamp(380px, 58dvh, 640px)"
          :fit-max-zoom="mapPageZoom"
          :focus-zoom="mapPageZoom"
          @detail="openPhotoDetail"
        />
      </div>
      <div class="map-list">
        <button
          v-for="photo in photos"
          :key="photo.id"
          class="map-photo-card"
          :class="{ active: selectedPhotoId === photo.id }"
          type="button"
          @click="focusPhoto(photo)"
        >
          <img :src="imageUrl(photo.thumbnailUrl)" :alt="photo.title" />
          <span>{{ photo.title }}</span>
          <small>{{ photo.city || photo.locationName }}</small>
        </button>
      </div>
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '../../api/request.js';
import MapViewer from '../../components/map/MapViewer.vue';
import PhotoDetailSheet from '../../components/photo/PhotoDetailSheet.vue';
import { imageUrl } from '../../utils/image.js';
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
const filteredCities = computed(() => {
  if (!filters.country) return cities.value;
  return cities.value.filter((city) => city.country === filters.country);
});
const mapScene = computed(() => mapSceneForPhotos(photos.value, filters.country));
const mapPageZoom = computed(() => mapZoomForScene(settings.settings, mapScene.value, 'page'));

const load = async () => {
  const res = await request.get('/map/photos', { params: filters });
  photos.value = res.data;
  selectedPhotoId.value = null;
};

const handleCountryChange = () => {
  if (filters.city && !filteredCities.value.some((city) => city.city === filters.city)) {
    filters.city = '';
  }
  load();
};

const focusPhoto = (photo) => {
  selectedPhotoId.value = photo.id;
  mapStageRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const photoZoom = mapZoomForScene(settings.settings, mapSceneForPhoto(photo), 'detail');
  mapViewerRef.value?.focusPhoto(photo, photoZoom);
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

onMounted(async () => {
  const [cityRes, countryRes, yearRes] = await Promise.all([
    request.get('/map/cities'),
    request.get('/map/countries'),
    request.get('/map/years'),
    load()
  ]);
  cities.value = cityRes.data;
  countries.value = countryRes.data;
  years.value = yearRes.data;
});
</script>

<style scoped>
.toolbar {
  padding: 14px;
}

.toolbar .el-input,
.toolbar .el-select {
  width: 210px;
}

.map-stage {
  scroll-margin-top: 18px;
}

.map-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.map-photo-card {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  color: var(--theme-text);
  background: var(--theme-surface-glass);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.map-photo-card:hover,
.map-photo-card:focus-visible,
.map-photo-card.active {
  border-color: var(--theme-primary);
  box-shadow: var(--theme-shadow);
  transform: translateY(-2px);
  outline: none;
}

.map-list img {
  width: 100%;
  height: 110px;
  object-fit: cover;
}

.map-list span,
.map-list small {
  display: block;
  padding: 8px 10px 0;
}

.map-list small {
  color: var(--theme-muted-strong);
  padding-bottom: 10px;
}
</style>
