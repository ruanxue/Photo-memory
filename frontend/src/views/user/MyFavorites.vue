<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">我的收藏</h1>
        <p class="section-subtitle">你标记过的喜欢照片。</p>
      </div>
    </div>
    <PhotoWaterfall :photos="photos" :loading="loading" @preview="openLightbox" />
    <PhotoLightbox v-model:index="lightboxIndex" :visible="lightboxVisible" :photos="photos" @close="lightboxVisible = false" />
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import request from '../../api/request.js';
import PhotoWaterfall from '../../components/photo/PhotoWaterfall.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';

const photos = ref([]);
const loading = ref(true);
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);

onMounted(async () => {
  try {
    const res = await request.get('/my/favorites', { params: { pageSize: 60 } });
    photos.value = res.data.map((item) => item.photo);
  } finally {
    loading.value = false;
  }
});

const openLightbox = (photo) => {
  lightboxIndex.value = photos.value.findIndex((item) => item.id === photo.id);
  lightboxVisible.value = true;
};
</script>
