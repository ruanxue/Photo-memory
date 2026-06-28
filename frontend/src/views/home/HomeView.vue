<template>
  <section class="home-hero" :class="{ 'home-hero-loading': !heroReady }" :style="heroStyle">
    <div class="hero-shade">
      <div class="hero-frame">
        <div class="hero-copy">
          <p v-if="settings.siteSubtitle" class="kicker">{{ settings.siteSubtitle }}</p>
          <h1 class="hero-title" :class="{ 'is-stacked': heroTitleLines.length > 1 }">
            <span v-for="line in heroTitleLines" :key="line">{{ line }}</span>
          </h1>
          <p v-if="settings.homeIntro" class="intro">{{ settings.homeIntro }}</p>
        </div>

        <aside class="hero-side">
          <div class="hero-stats" aria-label="站点统计">
            <div><strong>{{ stats.photos }}</strong><span>公开照片</span></div>
            <div><strong>{{ stats.albums }}</strong><span>相册</span></div>
            <div><strong>{{ stats.views }}</strong><span>浏览量</span></div>
            <div><strong>{{ stats.cities }}</strong><span>城市</span></div>
            <div><strong>{{ stats.tags }}</strong><span>标签</span></div>
          </div>
          <button v-if="canRefreshHero" class="hero-refresh" type="button" aria-label="换一张主图" @click="pickHero">
            <el-icon><Refresh /></el-icon>
          </button>
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
import { imageUrl, photoImageUrl } from '../../utils/image.js';
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
const heroReady = ref(false);
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
let wallObserver = null;
const fallbackHero = 'https://picsum.photos/seed/photo-memory-hero/2200/1400';
const heroImage = computed(() => {
  if (!heroReady.value) return '';
  if (!heroPhoto.value || heroPhoto.value.externalStatus === 'failed') return imageUrl(fallbackHero);
  return photoImageUrl(heroPhoto.value, ['mediumUrl', 'originalUrl', 'thumbnailUrl']);
});
const heroStyle = computed(() => (heroImage.value ? { backgroundImage: `url(${heroImage.value})` } : {}));
const heroTitleLines = computed(() => {
  const title = String(settings.siteName || '').trim();
  if (!title) return [];
  if (title.length <= 4 || /[\s·|,，。]/.test(title)) return [title];
  const splitAt = Math.ceil(title.length / 2);
  return [title.slice(0, splitAt), title.slice(splitAt)];
});
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
  sort: 'custom'
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
    const res = await photoApi.wall(wallPhotoParams());
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
  heroReady.value = false;
  try {
    page.value = 1;
    pageSize.value = WALL_PAGE_SIZE;
    const heroIds = configuredHeroIds.value;
    const heroRequest = heroIds.length
      ? photoApi.list({ ids: heroIds.join(','), pageSize: Math.min(heroIds.length, WALL_PAGE_SIZE) })
      : Promise.resolve({ data: [] });
    const [wallRes, latestRes, albumRes, tagRes, cityRes, heroRes] = await Promise.all([
      photoApi.wall({ page: 1, pageSize: WALL_PAGE_SIZE, sort: 'custom' }),
      photoApi.wall({ page: 1, pageSize: 1, includeAlbumPhotos: true, sort: 'latest' }),
      albumApi.list({ pageSize: WALL_PAGE_SIZE }),
      tagApi.list(),
      request.get('/map/cities'),
      heroRequest
    ]);
    featured.value = wallRes.data || [];
    totalPhotos.value = wallRes.meta?.total || featured.value.length;
    stats.photos = latestRes.meta?.total || wallRes.meta?.total || featured.value.length;
    stats.albums = albumRes.meta?.total || albumRes.data?.length || 0;
    wallAlbums.value = albumRes.data || [];
    stats.views = featured.value.reduce((sum, item) => sum + (item.viewCount || 0), 0);
    stats.cities = cityRes.data?.length || 0;
    stats.tags = tagRes.data?.length || 0;
    heroCandidates.value = heroRes.data || [];
    applyHeroSelection();
  } finally {
    heroReady.value = true;
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

.home-hero::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  z-index: 1;
  height: clamp(120px, 18vh, 240px);
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      transparent 0%,
      color-mix(in srgb, var(--theme-wall-page-bg) 18%, transparent) 38%,
      color-mix(in srgb, var(--theme-wall-page-bg) 76%, transparent) 76%,
      var(--theme-wall-page-bg) 100%
    );
}

.home-hero-loading {
  background: var(--theme-page-bg);
}

.hero-shade {
  position: relative;
  z-index: 0;
  min-height: 100vh;
  color: var(--theme-hero-text);
  background: var(--theme-hero-shade-bg);
}

.hero-frame {
  min-height: 100vh;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 270px);
  grid-template-rows: minmax(84px, 1fr) auto;
  grid-template-areas:
    ". side"
    "copy side";
  gap: clamp(18px, 5vw, 96px);
  padding: clamp(26px, 5vw, 76px);
}

.hero-copy {
  grid-area: copy;
  width: min(760px, 62vw);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "kicker"
    "title"
    "intro";
  align-items: start;
  row-gap: clamp(10px, 1.2vw, 16px);
  align-self: end;
  margin-bottom: clamp(24px, 5vw, 74px);
}

.kicker {
  grid-area: kicker;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  margin: 0;
  color: var(--theme-hero-kicker);
  font-size: clamp(13px, 1.15vw, 16px);
  font-weight: 800;
  line-height: 1.2;
  text-shadow: 0 1px 18px color-mix(in srgb, var(--theme-page-bg) 46%, transparent);
}

.kicker::before {
  content: "";
  width: clamp(30px, 4vw, 58px);
  height: 1px;
  background: currentColor;
  opacity: 0.66;
}

.hero-title {
  grid-area: title;
  max-width: min(720px, 100%);
  margin: 0;
  color: var(--theme-hero-text);
  font-size: clamp(44px, 6.7vw, 112px);
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: 0;
  text-wrap: balance;
  text-shadow:
    0 2px 30px color-mix(in srgb, var(--theme-page-bg) 28%, transparent),
    0 18px 74px color-mix(in srgb, var(--theme-page-bg) 18%, transparent);
}

.hero-title span {
  display: block;
}

.hero-title.is-stacked {
  font-size: clamp(48px, 7vw, 118px);
}

.hero-title.is-stacked span + span {
  margin-top: clamp(2px, 0.6vw, 10px);
}

.intro {
  grid-area: intro;
  max-width: 620px;
  margin: 0;
  padding: 10px 0 4px clamp(14px, 1.5vw, 20px);
  border-left: 1px solid color-mix(in srgb, var(--theme-hero-muted) 54%, transparent);
  color: var(--theme-hero-muted);
  font-size: clamp(13px, 1.05vw, 16px);
  font-weight: 600;
  line-height: 1.8;
  text-wrap: pretty;
  text-shadow: 0 1px 18px color-mix(in srgb, var(--theme-page-bg) 38%, transparent);
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
  z-index: 3;
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
  position: relative;
  z-index: 0;
  width: 100%;
  min-height: 100vh;
  margin-top: -1px;
  padding: clamp(28px, 4vh, 56px) 0 92px;
  background: var(--theme-wall-page-bg);
}

.home-load-sentinel {
  width: 100%;
  height: 2px;
  pointer-events: none;
}

@media (max-width: 760px) {
  .hero-frame {
    grid-template-columns: minmax(0, 1fr) minmax(82px, 26vw);
    grid-template-rows: minmax(76px, 1fr) auto minmax(58px, 0.16fr);
    gap: 14px;
    padding: 22px 16px 32px;
  }

  .hero-copy {
    width: min(100%, 72vw);
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "kicker"
      "title"
      "intro";
    row-gap: 12px;
  }

  .kicker {
    font-size: 12px;
  }

  .kicker::before {
    width: 28px;
  }

  .hero-title,
  .hero-title.is-stacked {
    max-width: none;
    font-size: clamp(48px, 16vw, 88px);
  }

  .intro {
    max-width: none;
    margin: 0;
    padding: 12px 0 0;
    border-left: 0;
    border-top: 1px solid color-mix(in srgb, var(--theme-hero-muted) 42%, transparent);
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
  .hero-frame {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "."
      "copy"
      ".";
  }

  .hero-copy {
    width: 100%;
  }

  .hero-side {
    display: none;
  }
}
</style>
