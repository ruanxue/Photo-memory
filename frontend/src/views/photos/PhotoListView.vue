<template>
  <section class="page-hero container photo-hero">
    <h1>照片墙</h1>
    <p>更贴近屏幕边缘的沉浸瀑布流，按时间、热度、标签和城市筛选。</p>
  </section>
  <section class="section photo-wall-section">
    <div class="full-bleed">
      <div class="toolbar surface filter-bar">
        <el-input v-model="filters.q" placeholder="搜索标题、地点、设备" clearable @keyup.enter="reload" />
        <el-select v-model="filters.sort" placeholder="排序" @change="reload">
          <el-option label="最新上传" value="latest" />
          <el-option label="拍摄时间" value="taken" />
          <el-option label="浏览量" value="views" />
          <el-option label="评论数" value="comments" />
        </el-select>
        <el-select v-model="filters.tagId" clearable placeholder="标签" @change="reload">
          <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
        </el-select>
        <el-input v-model="filters.city" clearable placeholder="城市" @keyup.enter="reload" />
        <el-input v-model="filters.year" clearable placeholder="年份" @keyup.enter="reload" />
        <el-checkbox v-model="filters.pinned" @change="reload">置顶</el-checkbox>
        <el-checkbox v-model="filters.featured" @change="reload">精选</el-checkbox>
        <el-button type="primary" @click="reload">筛选</el-button>
      </div>
      <PhotoWaterfall
        variant="wall"
        :photos="photos"
        :albums="albums"
        :include-albums="settings.settings.includeAlbumsInWaterfall"
        :loading="initialLoading"
        :scroll-reveal="false"
        @preview="openLightbox"
      />
      <div v-if="allPhotos.length" ref="loadMoreRef" class="load-more-sentinel">
        <span v-if="loadingMore">正在加载更多照片...</span>
        <span v-else-if="hasMore">继续向下滑动加载更多</span>
        <span v-else>已经到底了</span>
      </div>
    </div>
  </section>
  <PhotoLightbox v-model:index="lightboxIndex" :visible="lightboxVisible" :photos="allPhotos" :navigation="false" @close="lightboxVisible = false" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { photoApi } from '../../api/photo.api.js';
import { albumApi } from '../../api/album.api.js';
import { tagApi } from '../../api/tag.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import PhotoWaterfall from '../../components/photo/PhotoWaterfall.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';

const route = useRoute();
const settings = useSettingsStore();
const photos = ref([]);
const albums = ref([]);
const tags = ref([]);
const initialLoading = ref(false);
const loadingMore = ref(false);
const loadMoreRef = ref(null);
const page = ref(1);
const WALL_PAGE_SIZE = 100;
const pageSize = ref(WALL_PAGE_SIZE);
const total = ref(0);
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);
const filters = reactive({
  q: route.query.q || '',
  sort: route.query.sort || settings.settings.defaultSort || 'latest',
  tagId: route.query.tagId ? Number(route.query.tagId) : null,
  city: route.query.city || '',
  year: route.query.year || '',
  pinned: route.query.pinned === 'true',
  featured: route.query.featured === 'true'
});
let observer = null;

const allPhotos = computed(() => photos.value);
const hasMore = computed(() => allPhotos.value.length < total.value);

const params = () => ({
  page: page.value,
  pageSize: pageSize.value,
  ...filters,
  pinned: filters.pinned ? 'true' : undefined,
  featured: filters.featured ? 'true' : undefined
});

const load = async ({ append = false } = {}) => {
  if (append) loadingMore.value = true;
  else initialLoading.value = true;
  try {
    const res = await photoApi.wall(params());
    if (append) {
      const existing = new Set(allPhotos.value.map((photo) => photo.id));
      const nextPhotos = res.data.filter((photo) => !existing.has(photo.id));
      if (nextPhotos.length) photos.value = [...photos.value, ...nextPhotos];
    } else {
      photos.value = res.data;
    }
    total.value = res.meta?.total || 0;
  } finally {
    initialLoading.value = false;
    loadingMore.value = false;
    await nextTick();
    observeLoadMore();
  }
};

const reload = () => {
  page.value = 1;
  load({ append: false });
};

const loadMore = async () => {
  if (initialLoading.value || loadingMore.value || !hasMore.value) return;
  page.value += 1;
  await load({ append: true });
};

const openLightbox = (photo) => {
  lightboxIndex.value = allPhotos.value.findIndex((item) => item.id === photo.id);
  lightboxVisible.value = true;
};

onMounted(async () => {
  const [tagRes, albumRes] = await Promise.all([tagApi.list(), albumApi.list({ pageSize: WALL_PAGE_SIZE })]);
  tags.value = tagRes.data;
  albums.value = albumRes.data;
  await load({ append: false });
});

watch(() => settings.loaded, () => {
  if (!route.query.sort) filters.sort = settings.settings.defaultSort || 'latest';
  pageSize.value = WALL_PAGE_SIZE;
});

watch(() => route.query, () => {
  filters.q = route.query.q || '';
  reload();
});

const observeLoadMore = () => {
  observer?.disconnect();
  if (!loadMoreRef.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root: null, rootMargin: '520px 0px', threshold: 0.01 }
  );
  observer.observe(loadMoreRef.value);
};

onBeforeUnmount(() => observer?.disconnect());
</script>

<style scoped>
.photo-hero {
  padding-bottom: 10px;
}

.photo-wall-section {
  padding-top: 16px;
}

.filter-bar {
  padding: 12px;
  margin: 0 0 12px;
}

.filter-bar .el-input,
.filter-bar .el-select {
  width: 180px;
}

.load-more-sentinel {
  min-height: 96px;
  display: grid;
  place-items: center;
  color: var(--theme-muted-strong);
  font-size: 13px;
}

@media (max-width: 760px) {
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100%;
  }
}
</style>
