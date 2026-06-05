<template>
  <section class="page-hero container">
    <h1>标签</h1>
    <p>从城市、情绪、人物、设备和主题快速进入照片集合。</p>
  </section>
  <section class="section">
    <div class="container">
      <TagCloud :tags="tags" />
      <div v-if="selectedTag" class="section-head nested">
        <div>
          <h2 class="section-title">#{{ selectedTag.name }}</h2>
          <p class="section-subtitle">{{ selectedTag.photoCount }} 张照片</p>
        </div>
      </div>
      <PhotoWaterfall v-if="selectedId" :photos="photos" :loading="loading" @preview="openLightbox" />
    </div>
  </section>
  <PhotoLightbox v-model:index="lightboxIndex" :visible="lightboxVisible" :photos="photos" @close="lightboxVisible = false" />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { tagApi } from '../../api/tag.api.js';
import TagCloud from '../../components/common/TagCloud.vue';
import PhotoWaterfall from '../../components/photo/PhotoWaterfall.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';

const route = useRoute();
const tags = ref([]);
const photos = ref([]);
const loading = ref(false);
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);
const selectedId = computed(() => (route.params.id ? Number(route.params.id) : null));
const selectedTag = computed(() => tags.value.find((item) => item.id === selectedId.value));

const loadPhotos = async () => {
  if (!selectedId.value) return;
  loading.value = true;
  try {
    const res = await tagApi.photos(selectedId.value, { pageSize: 60 });
    photos.value = res.data.photos;
  } finally {
    loading.value = false;
  }
};

const openLightbox = (photo) => {
  lightboxIndex.value = photos.value.findIndex((item) => item.id === photo.id);
  lightboxVisible.value = true;
};

onMounted(async () => {
  const res = await tagApi.list();
  tags.value = res.data;
  await loadPhotos();
});
watch(selectedId, loadPhotos);
</script>

<style scoped>
.nested {
  margin-top: 36px;
}
</style>
