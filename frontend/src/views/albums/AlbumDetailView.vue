<template>
  <LoadingState v-if="loading" class="container section" />
  <template v-else-if="album">
    <section class="album-hero">
      <div class="container">
        <h1>{{ album.title }}</h1>
        <p>{{ album.description || '这个相册还没有描述。' }}</p>
        <span>{{ album.photos?.length || album.photoCount || 0 }} 张照片</span>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <PhotoWaterfall :photos="album.photos || []" @preview="openLightbox" />
      </div>
    </section>
  </template>
  <PhotoLightbox v-model:index="lightboxIndex" :visible="lightboxVisible" :photos="album?.photos || []" @close="lightboxVisible = false" />
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { albumApi } from '../../api/album.api.js';
import LoadingState from '../../components/common/LoadingState.vue';
import PhotoWaterfall from '../../components/photo/PhotoWaterfall.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';

const route = useRoute();
const album = ref(null);
const loading = ref(true);
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);

const load = async () => {
  loading.value = true;
  try {
    const res = await albumApi.detail(route.params.id);
    album.value = res.data;
  } finally {
    loading.value = false;
  }
};

const openLightbox = (photo) => {
  lightboxIndex.value = album.value.photos.findIndex((item) => item.id === photo.id);
  lightboxVisible.value = true;
};

onMounted(load);
watch(() => route.params.id, load);
</script>

<style scoped>
.album-hero {
  padding: 82px 0 42px;
  background: var(--theme-surface-soft);
}

h1 {
  margin: 0;
  font-size: clamp(38px, 7vw, 92px);
}

p {
  max-width: 680px;
  color: var(--theme-muted-strong);
  line-height: 1.8;
}
</style>
