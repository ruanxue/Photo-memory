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
      <MapViewer :photos="photos" height="640px" />
      <div class="map-list">
        <router-link v-for="photo in photos" :key="photo.id" :to="`/photos/${photo.id}`">
          <img :src="photo.thumbnailUrl" :alt="photo.title" />
          <span>{{ photo.title }}</span>
          <small>{{ photo.city || photo.locationName }}</small>
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '../../api/request.js';
import MapViewer from '../../components/map/MapViewer.vue';

const route = useRoute();
const photos = ref([]);
const countries = ref([]);
const filters = reactive({ city: route.query.city || '', country: '', year: '' });

const load = async () => {
  const res = await request.get('/map/photos', { params: filters });
  photos.value = res.data;
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

.map-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.map-list a {
  background: var(--surface-glass);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
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
  color: var(--muted-strong);
  padding-bottom: 10px;
}
</style>
