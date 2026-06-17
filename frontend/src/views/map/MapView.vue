<template>
  <section class="page-hero container">
    <h1>照片地图</h1>
    <p>只显示带 GPS 经纬度或手动填写过位置的照片，在地图上重走那些路。</p>
  </section>
  <section class="section">
    <div class="container">
      <div class="toolbar surface">
        <el-input v-model="filters.city" clearable placeholder="城市" @keyup.enter="load" />
        <el-select v-model="filters.country" clearable placeholder="国家 / 地区" @change="load">
          <el-option v-for="country in countries" :key="country.country" :label="`${country.country} (${country.count})`" :value="country.country" />
        </el-select>
        <el-input v-model="filters.year" clearable placeholder="年份" @keyup.enter="load" />
        <el-button type="primary" @click="load">筛选</el-button>
      </div>
      <div ref="mapStageRef" class="map-stage">
        <MapViewer ref="mapViewerRef" :photos="photos" height="640px" @detail="openPhotoDetail" />
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
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '../../api/request.js';
import MapViewer from '../../components/map/MapViewer.vue';
import PhotoDetailSheet from '../../components/photo/PhotoDetailSheet.vue';
import { imageUrl } from '../../utils/image.js';

const route = useRoute();
const photos = ref([]);
const countries = ref([]);
const selectedPhotoId = ref(null);
const mapViewerRef = ref(null);
const mapStageRef = ref(null);
const detailVisible = ref(false);
const detailPhoto = ref(null);
const filters = reactive({ city: route.query.city || '', country: '', year: '' });

const load = async () => {
  const res = await request.get('/map/photos', { params: filters });
  photos.value = res.data;
  selectedPhotoId.value = null;
};

const focusPhoto = (photo) => {
  selectedPhotoId.value = photo.id;
  mapViewerRef.value?.focusPhoto(photo);
  mapStageRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const [countryRes] = await Promise.all([request.get('/map/countries'), load()]);
  countries.value = countryRes.data;
});
</script>

<style scoped>
.toolbar {
  padding: 14px;
}

.toolbar .el-input,
.toolbar .el-select {
  width: 190px;
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
