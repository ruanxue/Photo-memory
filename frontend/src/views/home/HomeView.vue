<template>
  <section class="home-hero" :style="{ backgroundImage: `url(${heroImage})` }">
    <div class="hero-shade">
      <div class="hero-frame">
        <div class="hero-copy">
          <p class="kicker">{{ settings.siteSubtitle }}</p>
          <h1>{{ settings.siteName }}</h1>
          <p class="intro">{{ settings.homeIntro }}</p>
        </div>

        <aside class="hero-side">
          <div class="hero-stats" aria-label="站点统计">
            <div><strong>{{ stats.photos }}</strong><span>公开照片</span></div>
            <div><strong>{{ stats.albums }}</strong><span>相册</span></div>
            <div><strong>{{ stats.views }}</strong><span>浏览量</span></div>
            <div><strong>{{ stats.cities }}</strong><span>城市</span></div>
            <div><strong>{{ stats.tags }}</strong><span>标签</span></div>
          </div>
          <el-tooltip v-if="canRefreshHero" content="换一张主图" placement="left" popper-class="dock-tooltip">
            <button class="hero-refresh" type="button" aria-label="换一张主图" @click="pickHero">
              <el-icon><Refresh /></el-icon>
            </button>
          </el-tooltip>
        </aside>
      </div>
    </div>
    <button class="hero-scroll" type="button" aria-label="前往照片墙" @click="scrollToWall">
      <el-icon><ArrowDown /></el-icon>
    </button>
  </section>

  <section ref="wallSectionRef" class="home-wall">
    <PhotoWaterfall
      variant="wall"
      :photos="featured"
      :albums="wallAlbums"
      :include-albums="settings.settings.includeAlbumsInWaterfall"
      :loading="loading"
      show-credit-card
      @preview="openLightbox(featured, $event)"
    />
    <div v-if="featured.length && hasMore" ref="loadMoreRef" class="home-load-sentinel" aria-hidden="true"></div>
  </section>

  <FloatingDock :visible="dockVisible" home />
  <PhotoLightbox v-model:index="lightboxIndex" :visible="lightboxVisible" :photos="lightboxPhotos" :navigation="false" @close="lightboxVisible = false" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ArrowDown, Refresh } from '@element-plus/icons-vue';
import request from '../../api/request.js';
import { albumApi } from '../../api/album.api.js';
import { photoApi } from '../../api/photo.api.js';
import { tagApi } from '../../api/tag.api.js';
import { imageUrl } from '../../utils/image.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import FloatingDock from '../../components/common/FloatingDock.vue';
import PhotoWaterfall from '../../components/photo/PhotoWaterfall.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';

const settings = useSettingsStore();
const loading = ref(true);
const loadingMore = ref(false);
const featured = ref([]);
const wallAlbums = ref([]);
const heroCandidates = ref([]);
const heroPhoto = ref(null);
const wallSectionRef = ref(null);
const loadMoreRef = ref(null);
const dockVisible = ref(false);
const stats = reactive({ photos: 0, albums: 0, views: 0, cities: 0, tags: 0 });
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);
const lightboxPhotos = ref([]);
const page = ref(1);
const WALL_PAGE_SIZE = 100;
const pageSize = ref(WALL_PAGE_SIZE);
const totalPhotos = ref(0);
const wallMode = ref('latest');
let wallObserver = null;
const fallbackHero = 'https://picsum.photos/seed/photo-memory-hero/2200/1400';
const heroImage = computed(() => imageUrl(heroPhoto.value?.mediumUrl || heroPhoto.value?.originalUrl || fallbackHero));
const heroMode = computed(() => settings.settings.heroMode === 'fixed' ? 'fixed' : 'random');
const configuredHeroIds = computed(() => Array.isArray(settings.settings.heroPhotoIds) ? settings.settings.heroPhotoIds : []);
const fixedHero = computed(() => {
  const fixedId = Number(settings.settings.heroFixedPhotoId);
  if (heroMode.value !== 'fixed' || !fixedId) return null;
  return heroCandidates.value.find((photo) => photo.id === fixedId) || null;
});
const heroPool = computed(() => heroCandidates.value.length ? heroCandidates.value : featured.value);
const canRefreshHero = computed(() => !fixedHero.value && heroPool.value.length > 1);
const hasMore = computed(() => featured.value.length < totalPhotos.value);

const pickHero = () => {
  const pool = heroPool.value;
  heroPhoto.value = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
};

const applyHeroSelection = () => {
  if (fixedHero.value) {
    heroPhoto.value = fixedHero.value;
    return;
  }
  pickHero();
};

const updateDockVisibility = () => {
  const threshold = wallSectionRef.value?.offsetTop || window.innerHeight * 0.82;
  dockVisible.value = window.scrollY > threshold - window.innerHeight * 0.2;
};

const scrollToWall = () => {
  wallSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const wallPhotoParams = () => ({
  page: page.value,
  pageSize: pageSize.value,
  sort: wallMode.value === 'featured' ? 'latest' : (settings.settings.defaultSort || 'latest'),
  featured: wallMode.value === 'featured' ? true : undefined
});

const observeHomeLoadMore = async () => {
  await nextTick();
  wallObserver?.disconnect();
  if (!loadMoreRef.value || !hasMore.value) return;
  wallObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root: null, rootMargin: '720px 0px', threshold: 0.01 }
  );
  wallObserver.observe(loadMoreRef.value);
};

const loadWallPhotos = async ({ append = false } = {}) => {
  if (append) loadingMore.value = true;
  try {
    const res = await photoApi.list(wallPhotoParams());
    const nextPhotos = res.data || [];
    if (append) {
      const existing = new Set(featured.value.map((photo) => photo.id));
      const uniquePhotos = nextPhotos.filter((photo) => !existing.has(photo.id));
      if (uniquePhotos.length) featured.value = [...featured.value, ...uniquePhotos];
    } else {
      featured.value = nextPhotos;
    }
    totalPhotos.value = res.meta?.total || featured.value.length;
  } finally {
    loadingMore.value = false;
    await observeHomeLoadMore();
  }
};

const loadMore = async () => {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  page.value += 1;
  await loadWallPhotos({ append: true });
};

const load = async () => {
  loading.value = true;
  try {
    page.value = 1;
    pageSize.value = WALL_PAGE_SIZE;
    const heroIds = configuredHeroIds.value;
    const heroRequest = heroIds.length
      ? photoApi.list({ ids: heroIds.join(','), pageSize: Math.min(heroIds.length, WALL_PAGE_SIZE) })
      : Promise.resolve({ data: [] });
    const [featuredRes, latestRes, albumRes, tagRes, cityRes, heroRes] = await Promise.all([
      photoApi.list({ featured: true, page: 1, pageSize: WALL_PAGE_SIZE, sort: 'latest' }),
      photoApi.list({ page: 1, pageSize: WALL_PAGE_SIZE, sort: settings.settings.defaultSort || 'latest' }),
      albumApi.list({ pageSize: WALL_PAGE_SIZE }),
      tagApi.list(),
      request.get('/map/cities'),
      heroRequest
    ]);
    const featuredTotal = featuredRes.meta?.total || featuredRes.data.length;
    wallMode.value = featuredTotal >= 40 ? 'featured' : 'latest';
    const wallRes = wallMode.value === 'featured' ? featuredRes : latestRes;
    featured.value = wallRes.data || [];
    totalPhotos.value = wallRes.meta?.total || featured.value.length;
    stats.photos = latestRes.meta?.total || featuredRes.meta?.total || featured.value.length;
    stats.albums = albumRes.meta?.total || albumRes.data?.length || 0;
    wallAlbums.value = albumRes.data || [];
    stats.views = featured.value.reduce((sum, item) => sum + (item.viewCount || 0), 0);
    stats.cities = cityRes.data?.length || 0;
    stats.tags = tagRes.data?.length || 0;
    heroCandidates.value = heroRes.data || [];
    applyHeroSelection();
  } finally {
    loading.value = false;
    await observeHomeLoadMore();
  }
};

const openLightbox = (source, photo) => {
  lightboxPhotos.value = source;
  lightboxIndex.value = source.findIndex((item) => item.id === photo.id);
  lightboxVisible.value = true;
};

onMounted(async () => {
  if (!settings.loaded) await settings.fetchPublicSettings();
  await load();
  updateDockVisibility();
  window.addEventListener('scroll', updateDockVisibility, { passive: true });
  window.addEventListener('resize', updateDockVisibility);
});

onBeforeUnmount(() => {
  wallObserver?.disconnect();
  window.removeEventListener('scroll', updateDockVisibility);
  window.removeEventListener('resize', updateDockVisibility);
});
</script>

<style scoped>
.home-hero {
  position: relative;
  min-height: 100vh;
  background-size: cover;
  background-position: center;
}

.hero-shade {
  min-height: 100vh;
  color: var(--theme-hero-text);
  background: var(--theme-hero-shade-bg);
}

.hero-frame {
  min-height: 100vh;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 270px);
  grid-template-rows: 1fr auto;
  grid-template-areas:
    ". side"
    "copy side";
  gap: clamp(18px, 5vw, 96px);
  padding: clamp(26px, 5vw, 76px);
}

.hero-copy {
  grid-area: copy;
  max-width: min(980px, 72vw);
  align-self: end;
}

.kicker {
  margin: 0 0 12px;
  color: var(--theme-hero-kicker);
  font-weight: 800;
}

h1 {
  max-width: 980px;
  margin: 0;
  font-size: clamp(46px, 9.8vw, 154px);
  line-height: 0.88;
}

.intro {
  max-width: 620px;
  margin: 20px 0 0;
  color: var(--theme-hero-muted);
  font-size: clamp(14px, 1.25vw, 17px);
  line-height: 1.85;
}

.hero-side {
  grid-area: side;
  display: grid;
  justify-items: end;
  align-content: end;
  gap: 22px;
  text-align: right;
}

.hero-stats {
  display: grid;
  gap: 14px;
}

.hero-stats div {
  display: grid;
  gap: 2px;
}

.hero-stats strong {
  font-size: clamp(22px, 3vw, 40px);
  line-height: 1;
}

.hero-stats span {
  color: var(--theme-hero-subtle);
  font-size: 12px;
}

.hero-refresh {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-hero-control-border);
  border-radius: 50%;
  color: var(--theme-hero-control-text);
  background: var(--theme-hero-control-bg);
  backdrop-filter: blur(16px);
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease, color 0.22s ease;
}

.hero-refresh:hover {
  color: var(--theme-dock-active-text);
  border-color: var(--theme-dock-active-bg);
  background: var(--theme-dock-active-bg);
  transform: translateY(-2px);
}

.hero-scroll {
  position: absolute;
  left: 50%;
  bottom: clamp(18px, 3vw, 34px);
  z-index: 2;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-hero-control-border);
  border-radius: 50%;
  color: var(--theme-hero-control-text);
  background: var(--theme-hero-control-bg);
  backdrop-filter: blur(16px);
  cursor: pointer;
  transform: translateX(-50%);
  transition: transform 0.22s ease, background 0.22s ease, color 0.22s ease, border-color 0.22s ease;
}

.hero-scroll:hover {
  color: var(--theme-dock-active-text);
  border-color: var(--theme-dock-active-bg);
  background: var(--theme-dock-active-bg);
  transform: translateX(-50%) translateY(-2px);
}

.home-wall {
  width: 100%;
  min-height: 100vh;
  padding: 0 0 92px;
  background: var(--theme-wall-page-bg);
}

.home-load-sentinel {
  width: 100%;
  height: 2px;
  pointer-events: none;
}

@media (max-width: 760px) {
  .hero-frame {
    grid-template-columns: minmax(0, 1fr) minmax(92px, 28vw);
    gap: 14px;
    padding: 22px 16px 32px;
  }

  .hero-copy {
    max-width: none;
  }

  .intro {
    max-width: 70vw;
    font-size: 12px;
    line-height: 1.7;
  }

  .hero-stats {
    gap: 10px;
  }

  .hero-stats span {
    font-size: 11px;
  }

  .hero-refresh {
    width: 40px;
    height: 40px;
  }
}

@media (max-width: 440px) {
  .intro {
    display: none;
  }
}
</style>
