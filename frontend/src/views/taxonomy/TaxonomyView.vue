<template>
  <section class="page-hero container tags-hero">
    <div>
      <h1>标签</h1>
      <p>用标签连接地点、人物、情绪和照片细节，所有筛选入口都集中在这里。</p>
    </div>
  </section>

  <section class="section tags-section">
    <div class="container">
      <div class="tag-list surface">
        <router-link
          v-for="tag in tags"
          :key="tag.id"
          :to="`/tags/${tag.id}`"
          class="tag-item"
          :class="{ active: selectedId === tag.id }"
        >
          #{{ tag.name }}
          <span>{{ tag.photoCount }}</span>
        </router-link>
      </div>

      <div v-if="selectedTag" class="section-head nested">
        <div>
          <h2 class="section-title">#{{ selectedTag.name }}</h2>
          <p class="section-subtitle">{{ selectedTag.photoCount || 0 }} 张照片</p>
        </div>
      </div>

      <PhotoWaterfall v-if="selectedId" :photos="photos" :loading="loading" @preview="openLightbox" />
      <div v-else class="select-tip surface">选择一个标签，查看对应照片。</div>
    </div>
  </section>

  <PhotoLightbox v-model:index="lightboxIndex" :visible="lightboxVisible" :photos="photos" @close="lightboxVisible = false" />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { tagApi } from '../../api/tag.api.js';
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

const loadTags = async () => {
  const res = await tagApi.list();
  tags.value = res.data;
};

const loadPhotos = async () => {
  if (!selectedId.value) {
    photos.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await tagApi.photos(selectedId.value, { pageSize: 60 });
    photos.value = res.data.photos || [];
  } finally {
    loading.value = false;
  }
};

const openLightbox = (photo) => {
  lightboxIndex.value = photos.value.findIndex((item) => item.id === photo.id);
  lightboxVisible.value = true;
};

onMounted(async () => {
  await loadTags();
  await loadPhotos();
});

watch(() => route.params.id, loadPhotos);
</script>

<style scoped>
.tags-hero {
  padding-bottom: 18px;
}

.tags-section {
  padding-top: 12px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 18px;
  margin-bottom: 34px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--tag-border);
  border-radius: 999px;
  color: var(--primary-strong);
  background: var(--tag-bg);
}

.tag-item span {
  min-width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--primary-text);
  background: var(--primary-strong);
  font-size: 12px;
  font-weight: 900;
}

.tag-item.active,
.tag-item:hover {
  border-color: var(--primary-strong);
  background: var(--primary-soft);
}

.nested {
  margin-top: 8px;
}

.select-tip {
  padding: 24px;
  color: var(--muted-strong);
}
</style>
