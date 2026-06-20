<template>
  <section class="page-hero container photo-hero" :class="{ 'photo-wall-wide': settings.settings.waterfallFullBleed === true }">
    <h1>照片墙</h1>
    <p>更贴近屏幕边缘的沉浸瀑布流，按时间、热度、标签和城市筛选。</p>
  </section>
  <section class="section photo-wall-section">
    <div class="full-bleed">
      <div class="toolbar surface filter-bar" :class="{ 'photo-wall-wide': settings.settings.waterfallFullBleed === true }">
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
        <el-select v-model="filters.country" filterable clearable placeholder="国家 / 地区" @change="handleCountryChange">
          <el-option v-for="country in countries" :key="country.country" :label="`${country.country} (${country.count})`" :value="country.country" />
        </el-select>
        <el-select v-model="filters.city" filterable clearable placeholder="城市" @change="reload">
          <el-option v-for="city in filteredCities" :key="`${city.country || 'unknown'}-${city.city}`" :label="`${city.city} (${city.count})`" :value="city.city" />
        </el-select>
        <el-select v-model="filters.year" clearable placeholder="年份" @change="reload">
          <el-option v-for="item in years" :key="item.year" :label="`${item.year} (${item.count})`" :value="item.year" />
        </el-select>
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
const cities = ref([]);
const countries = ref([]);
const years = ref([]);
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
  country: route.query.country || '',
  city: route.query.city || '',
  year: route.query.year ? Number(route.query.year) : '',
  pinned: route.query.pinned === 'true',
  featured: route.query.featured === 'true'
});
let observer = null;

const allPhotos = computed(() => photos.value);
const hasMore = computed(() => allPhotos.value.length < total.value);
const filteredCities = computed(() => {
  if (!filters.country) return cities.value;
  return cities.value.filter((city) => city.country === filters.country);
});

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

const handleCountryChange = () => {
  if (filters.city && !filteredCities.value.some((city) => city.city === filters.city)) {
    filters.city = '';
  }
  reload();
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
  const [tagRes, albumRes, optionRes] = await Promise.all([
    tagApi.list(),
    albumApi.list({ pageSize: WALL_PAGE_SIZE }),
    photoApi.filterOptions()
  ]);
  tags.value = tagRes.data;
  albums.value = albumRes.data;
  countries.value = optionRes.data?.countries || [];
  cities.value = optionRes.data?.cities || [];
  years.value = optionRes.data?.years || [];
  await load({ append: false });
});

watch(() => settings.loaded, () => {
  if (!route.query.sort) filters.sort = settings.settings.defaultSort || 'latest';
  pageSize.value = WALL_PAGE_SIZE;
});

watch(() => route.query, () => {
  filters.q = route.query.q || '';
  filters.sort = route.query.sort || filters.sort || settings.settings.defaultSort || 'latest';
  filters.tagId = route.query.tagId ? Number(route.query.tagId) : null;
  filters.country = route.query.country || '';
  filters.city = route.query.city || '';
  filters.year = route.query.year ? Number(route.query.year) : '';
  filters.pinned = route.query.pinned === 'true';
  filters.featured = route.query.featured === 'true';
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
  --photo-wall-side-space: clamp(300px, 24vw, 560px);
  --photo-wall-safe-space: clamp(12px, 1.4vw, 28px);
  --photo-wall-content-width: min(100%, calc(100vw - var(--photo-wall-side-space)));
  width: var(--photo-wall-content-width);
  padding-bottom: 10px;
}

.photo-hero.photo-wall-wide {
  --photo-wall-content-width: min(100%, calc(100vw - var(--photo-wall-safe-space)));
}

.photo-wall-section {
  padding-top: 16px;
}

.filter-bar {
  --photo-wall-side-space: clamp(300px, 24vw, 560px);
  --photo-wall-safe-space: clamp(12px, 1.4vw, 28px);
  --photo-wall-content-width: min(100%, calc(100vw - var(--photo-wall-side-space)));
  width: var(--photo-wall-content-width);
  padding: 12px;
  margin: 0 auto 12px;
}

.filter-bar.photo-wall-wide {
  --photo-wall-content-width: min(100%, calc(100vw - var(--photo-wall-safe-space)));
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
  .photo-hero,
  .filter-bar {
    width: min(100%, calc(100vw - 16px));
  }

  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100%;
  }
}
</style>
