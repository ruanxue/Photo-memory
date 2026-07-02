<template>
  <main class="album-chapter-page" :class="{ 'is-fetching': isFetching }" :style="chapterStyle">
    <header class="chapter-nav">
      <button type="button" @click="returnToIndex">
        <el-icon><Back /></el-icon>
        <span>ROLL INDEX</span>
      </button>
      <div class="chapter-progress" aria-hidden="true">
        <span
          v-for="(_, index) in progressCells"
          :key="index"
          :class="{ active: index === currentIndex }"
        />
      </div>
      <span>PHOTO {{ pad(currentIndex + 1) }} · {{ album.title }}</span>
    </header>

    <section class="chapter-layout">
      <aside class="chapter-cover">
        <p class="chapter-kicker">CHAPTER {{ pad(album.id) }} · {{ albumLocation }}</p>
        <h1>{{ album.title }}</h1>
        <p class="album-script">{{ album.description || 'photo chapter · memory archive' }}</p>

        <div class="chapter-facts">
          <span>01 {{ albumPhotoCount }} 张照片</span>
          <span>02 {{ albumDate }}</span>
          <span>03 {{ albumLocation }}</span>
        </div>

        <blockquote>{{ currentPhoto?.description || album.description || 'The photographs keep the weather, the road, and the tiny pause before everything moved again.' }}</blockquote>

        <div class="chapter-stamp" aria-hidden="true">
          {{ albumYear }}
        </div>
      </aside>

      <section
        class="photo-stage"
        @mouseenter="paused = true"
        @mouseleave="paused = false"
        @wheel.prevent="handleWheel"
      >
        <template v-if="photos.length">
          <Transition name="photo-swap" mode="out-in">
            <figure :key="currentPhoto?.id || currentIndex" class="chapter-photo">
              <button class="photo-button" type="button" @click="openLightbox(currentIndex)">
                <img
                  :src="photoImageUrl(currentPhoto, ['mediumUrl', 'smallUrl', 'thumbnailUrl', 'originalUrl'])"
                  :srcset="photoImageSrcset(currentPhoto, ['thumbnailUrl', 'smallUrl', 'mediumUrl']) || undefined"
                  :sizes="photoImageSizes.detail"
                  :alt="currentPhoto?.title || album.title"
                  @error="handleImageError"
                />
              </button>
              <figcaption>
                <span>{{ currentPhoto?.title || album.title }}</span>
                <em>{{ photoLocation(currentPhoto) }}</em>
              </figcaption>
            </figure>
          </Transition>

          <div class="photo-counter" aria-live="polite">{{ pad(currentIndex + 1) }}</div>

          <nav class="thumb-rail" aria-label="相册照片">
            <button
              v-for="(photo, index) in photos"
              :key="photo.id"
              :class="{ active: index === currentIndex }"
              type="button"
              @click="selectPhoto(index)"
            >
              <img
                :src="photoImageUrl(photo, ['thumbnailUrl', 'smallUrl', 'mediumUrl'])"
                :srcset="photoImageSrcset(photo, ['thumbnailUrl', 'smallUrl']) || undefined"
                :sizes="photoImageSizes.thumb"
                :alt="photo.title"
                loading="lazy"
                @error="handleImageError"
              />
            </button>
          </nav>
        </template>

        <div v-else-if="isFetching" class="chapter-photo-placeholder" aria-hidden="true" />
        <EmptyState v-else class="chapter-empty" title="相册暂无照片" description="照片加入相册后会出现在这里。" />
      </section>
    </section>
  </main>

  <PhotoLightbox
    v-model:index="lightboxIndex"
    :visible="lightboxVisible"
    :photos="photos"
    navigation
    close-animation="corner"
    @close="lightboxVisible = false"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Back } from '@element-plus/icons-vue';
import { albumApi } from '../../api/album.api.js';
import EmptyState from '../../components/common/EmptyState.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';
import { createAlbumShell, readAlbumPreview, rememberAlbumPreview } from '../../utils/albumPreviewCache.js';
import { handleImageError, photoImageSizes, photoImageSrcset, photoImageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';

const route = useRoute();
const router = useRouter();
const album = ref(createAlbumShell(route.params.id));
const isFetching = ref(false);
const currentIndex = ref(0);
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);
const paused = ref(false);
let autoTimer = null;
let requestVersion = 0;
let wheelLocked = false;
let wheelLockTimer = null;

const palette = ['#d64a38', '#d6ad4a', '#168c98', '#55723b', '#263d73', '#9b4859'];

const pad = (value) => String(value).padStart(2, '0');
const photos = computed(() => album.value?.photos || []);
const currentPhoto = computed(() => photos.value[currentIndex.value] || photos.value[0] || null);
const albumPhotoCount = computed(() => photos.value.length || album.value?.photoCount || 0);
const albumAccent = computed(() => palette[Number(album.value?.id || 0) % palette.length]);
const progressCells = computed(() => photos.value.length ? photos.value : Array.from({ length: 8 }));

const dateValue = computed(() => album.value?.startDate || currentPhoto.value?.takenAt || album.value?.createdAt);
const albumDate = computed(() => formatDate(dateValue.value, '未知日期'));
const albumYear = computed(() => {
  const date = new Date(dateValue.value);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
});

const photoLocation = (photo) => photo?.city || photo?.locationName || photo?.province || photo?.country || 'MEMORY';
const albumLocation = computed(() => photoLocation(currentPhoto.value || album.value?.coverPhoto || album.value?.photos?.[0]));
const chapterStyle = computed(() => ({ '--chapter-accent': albumAccent.value }));

const clampIndex = () => {
  if (!photos.value.length) {
    currentIndex.value = 0;
    return;
  }
  if (currentIndex.value >= photos.value.length) currentIndex.value = photos.value.length - 1;
  if (currentIndex.value < 0) currentIndex.value = 0;
};

const selectPhoto = (index) => {
  if (!photos.value[index]) return;
  currentIndex.value = index;
};

const move = (step) => {
  if (!photos.value.length) return;
  currentIndex.value = (currentIndex.value + step + photos.value.length) % photos.value.length;
};

const handleWheel = (event) => {
  if (lightboxVisible.value || photos.value.length < 2) return;
  const delta = Number(event.deltaY || 0);
  if (Math.abs(delta) < 28 || wheelLocked) return;
  move(delta > 0 ? 1 : -1);
  wheelLocked = true;
  if (wheelLockTimer) window.clearTimeout(wheelLockTimer);
  wheelLockTimer = window.setTimeout(() => {
    wheelLocked = false;
    wheelLockTimer = null;
  }, 520);
};

const openLightbox = (index) => {
  lightboxIndex.value = index;
  lightboxVisible.value = true;
  paused.value = true;
};

const returnToIndex = () => {
  rememberAlbumPreview(album.value);
  router.push({ name: 'albums' });
};

const stopAuto = () => {
  if (!autoTimer) return;
  window.clearInterval(autoTimer);
  autoTimer = null;
};

const startAuto = () => {
  stopAuto();
  autoTimer = window.setInterval(() => {
    if (paused.value || lightboxVisible.value || photos.value.length < 2) return;
    move(1);
  }, 4600);
};

const albumPreviewFromState = () => {
  const routeState = typeof window === 'undefined' ? null : window.history.state;
  return readAlbumPreview(route.params.id, routeState);
};

const load = async () => {
  const version = ++requestVersion;
  const preview = albumPreviewFromState();
  album.value = preview || createAlbumShell(route.params.id);
  currentIndex.value = 0;
  isFetching.value = true;
  try {
    const res = await albumApi.detail(route.params.id);
    if (version !== requestVersion) return;
    album.value = res.data || createAlbumShell(route.params.id);
    rememberAlbumPreview(album.value);
    currentIndex.value = 0;
  } finally {
    if (version === requestVersion) isFetching.value = false;
  }
};

const onKey = (event) => {
  if (lightboxVisible.value) return;
  if (event.key === 'ArrowLeft') move(-1);
  if (event.key === 'ArrowRight') move(1);
};

onMounted(() => {
  load();
  startAuto();
  window.addEventListener('keydown', onKey);
});

watch(() => route.params.id, load);
watch(photos, clampIndex);
watch(lightboxVisible, (visible) => {
  paused.value = visible;
});

onBeforeUnmount(() => {
  stopAuto();
  window.removeEventListener('keydown', onKey);
  if (wheelLockTimer) window.clearTimeout(wheelLockTimer);
});
</script>

<style scoped>
.album-chapter-page {
  min-height: 100dvh;
  overflow: hidden;
  color: #0b0907;
  background: #050505;
}

.chapter-nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 20;
  height: 50px;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto minmax(180px, 1fr);
  align-items: center;
  gap: 18px;
  padding: 0 clamp(16px, 2.4vw, 28px);
  color: rgba(244, 234, 215, 0.5);
  background: rgba(4, 4, 4, 0.86);
  backdrop-filter: blur(12px);
  font-family: "Courier New", monospace;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chapter-nav button {
  width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(244, 234, 215, 0.12);
  border-radius: 2px;
  color: rgba(244, 234, 215, 0.72);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  font: inherit;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.chapter-nav button:hover,
.chapter-nav button:focus-visible {
  color: #fff6e7;
  border-color: var(--chapter-accent);
  background: color-mix(in srgb, var(--chapter-accent) 18%, transparent);
}

.chapter-nav > span {
  justify-self: end;
}

.chapter-progress {
  display: flex;
  align-items: center;
  gap: 7px;
}

.chapter-progress span {
  width: 22px;
  height: 8px;
  border: 1px solid rgba(244, 234, 215, 0.12);
  background: rgba(244, 234, 215, 0.18);
}

.chapter-progress span.active {
  width: 44px;
  border-color: var(--chapter-accent);
  background: var(--chapter-accent);
}

.chapter-layout {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: clamp(320px, 35vw, 560px) minmax(0, 1fr);
}

.chapter-cover {
  position: relative;
  min-height: 100dvh;
  padding: clamp(82px, 10.5vh, 112px) clamp(24px, 3vw, 46px) clamp(34px, 5vh, 54px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--chapter-accent) 92%, #f2c7a7), var(--chapter-accent)),
    var(--chapter-accent);
  animation: coverIn 0.72s cubic-bezier(0.22, 0.8, 0.2, 1) both;
}

.chapter-cover::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, transparent 62%, rgba(0, 0, 0, 0.12));
  opacity: 0.44;
}

.chapter-kicker,
.album-script,
.chapter-facts,
blockquote,
.chapter-stamp {
  font-family: "Courier New", monospace;
}

.chapter-kicker {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  position: relative;
  z-index: 1;
  max-width: 7.6ch;
  margin: 0;
  color: #080706;
  font-size: clamp(48px, 6.6vw, 104px);
  font-weight: 950;
  line-height: 0.92;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

h1::after {
  content: "";
  display: block;
  width: min(190px, 54%);
  height: 5px;
  margin-top: 16px;
  background: color-mix(in srgb, #f7ecd6 80%, var(--chapter-accent));
}

.album-script {
  position: relative;
  z-index: 1;
  max-width: 360px;
  margin: 18px 0 0;
  color: rgba(8, 7, 6, 0.62);
  font-size: 13px;
  font-style: italic;
  font-weight: 900;
  line-height: 1.7;
}

.chapter-facts {
  position: absolute;
  z-index: 1;
  bottom: clamp(74px, 10vh, 104px);
  left: clamp(24px, 3vw, 46px);
  display: grid;
  gap: 8px;
  color: rgba(8, 7, 6, 0.72);
  font-size: 12px;
  font-weight: 900;
}

blockquote {
  position: absolute;
  z-index: 1;
  right: clamp(24px, 3vw, 44px);
  bottom: clamp(76px, 10vh, 106px);
  width: min(230px, 44%);
  margin: 0;
  color: rgba(8, 7, 6, 0.72);
  font-size: 12px;
  font-weight: 900;
  line-height: 1.7;
}

.chapter-stamp {
  position: absolute;
  right: clamp(24px, 3vw, 46px);
  bottom: clamp(26px, 4vh, 42px);
  z-index: 1;
  width: 66px;
  height: 66px;
  display: grid;
  place-items: center;
  border: 2px solid rgba(8, 7, 6, 0.34);
  border-radius: 50%;
  color: rgba(8, 7, 6, 0.64);
  font-size: 12px;
  font-weight: 950;
}

.photo-stage {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  background: #070707;
  animation: stageIn 0.86s ease both;
}

.photo-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.36), transparent 28%, rgba(0, 0, 0, 0.5)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 4px);
}

.chapter-photo {
  position: absolute;
  inset: 0;
  margin: 0;
}

.photo-button {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: #070707;
  cursor: zoom-in;
}

.photo-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.92) contrast(1.04);
}

figcaption {
  position: absolute;
  right: clamp(132px, 12vw, 214px);
  bottom: clamp(30px, 4.4vh, 48px);
  left: clamp(28px, 4vw, 64px);
  z-index: 3;
  display: grid;
  justify-items: end;
  gap: 6px;
  color: rgba(255, 246, 231, 0.88);
  font-family: "Courier New", monospace;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: right;
  text-transform: lowercase;
  text-shadow: 0 3px 18px rgba(0, 0, 0, 0.7);
}

figcaption em {
  color: rgba(255, 246, 231, 0.62);
  font-style: normal;
}

.photo-counter {
  position: absolute;
  right: clamp(132px, 12vw, 214px);
  bottom: clamp(74px, 8.4vh, 104px);
  z-index: 3;
  color: rgba(255, 246, 231, 0.94);
  font-size: clamp(42px, 5vw, 70px);
  font-weight: 950;
  line-height: 0.85;
  text-align: right;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.72);
}

.thumb-rail {
  position: absolute;
  top: 72px;
  right: 12px;
  bottom: 0;
  z-index: 4;
  width: 68px;
  display: grid;
  align-content: start;
  gap: 8px;
  overflow-y: auto;
  padding: 14px 10px 18px;
  border: 1px solid rgba(255, 246, 231, 0.16);
  border-radius: 2px;
  background:
    linear-gradient(90deg, rgba(255, 246, 231, 0.05), transparent 24%, transparent 76%, rgba(255, 246, 231, 0.05)),
    rgba(2, 2, 2, 0.62);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.72),
    0 18px 44px rgba(0, 0, 0, 0.34);
  scrollbar-width: none;
}

.thumb-rail::before,
.thumb-rail::after {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  width: 5px;
  pointer-events: none;
  background: repeating-linear-gradient(
    180deg,
    rgba(255, 246, 231, 0.32) 0 4px,
    transparent 4px 12px
  );
  opacity: 0.62;
}

.thumb-rail::before {
  left: 3px;
}

.thumb-rail::after {
  right: 3px;
}

.thumb-rail::-webkit-scrollbar {
  width: 0;
}

.thumb-rail button {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 48px;
  height: 58px;
  overflow: hidden;
  padding: 0;
  border: 2px solid rgba(3, 3, 3, 0.84);
  border-radius: 1px;
  background: #111;
  cursor: pointer;
  opacity: 0.66;
  box-shadow:
    0 0 0 1px rgba(255, 246, 231, 0.16),
    inset 0 0 0 1px rgba(255, 246, 231, 0.08);
  transition: opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.thumb-rail button::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 18%, transparent 82%, rgba(0, 0, 0, 0.28)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px);
  mix-blend-mode: screen;
}

.thumb-rail button.active,
.thumb-rail button:hover,
.thumb-rail button:focus-visible {
  opacity: 1;
  border-color: var(--chapter-accent);
  box-shadow:
    0 0 0 1px rgba(255, 246, 231, 0.34),
    0 0 22px color-mix(in srgb, var(--chapter-accent) 34%, transparent);
  transform: none;
}

.thumb-rail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.88) contrast(1.04);
}

.chapter-photo-placeholder {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.36), transparent 34%, rgba(0, 0, 0, 0.62)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 4px),
    #070707;
}

.chapter-empty {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(420px, calc(100% - 40px));
  transform: translate(-50%, -50%);
}

.photo-swap-enter-active,
.photo-swap-leave-active {
  transition: opacity 0.42s ease, transform 0.52s cubic-bezier(0.22, 0.8, 0.2, 1), filter 0.42s ease;
}

.photo-swap-enter-from {
  opacity: 0;
  filter: grayscale(1) brightness(0.55);
  transform: translateX(8%) scale(1.03);
}

.photo-swap-leave-to {
  opacity: 0;
  filter: grayscale(1) brightness(0.5);
  transform: translateX(-6%) scale(1.02);
}

@keyframes coverIn {
  from {
    transform: translateX(-12%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes stageIn {
  from {
    opacity: 0;
    filter: grayscale(1) brightness(0.38);
  }
  to {
    opacity: 1;
    filter: grayscale(0) brightness(1);
  }
}

@media (max-width: 920px) {
  .album-chapter-page {
    overflow: visible;
  }

  .chapter-nav {
    position: sticky;
    grid-template-columns: 1fr;
    height: auto;
    padding-block: 10px;
  }

  .chapter-nav > span {
    justify-self: start;
  }

  .chapter-progress {
    flex-wrap: wrap;
  }

  .chapter-layout {
    min-height: auto;
    grid-template-columns: 1fr;
  }

  .chapter-cover {
    min-height: 58dvh;
    padding-top: 44px;
  }

  .photo-stage {
    min-height: 72dvh;
  }
}

@media (max-width: 620px) {
  .chapter-cover {
    padding-inline: 20px;
  }

  h1 {
    font-size: clamp(46px, 18vw, 78px);
  }

  blockquote {
    position: relative;
    right: auto;
    bottom: auto;
    width: auto;
    margin-top: 24px;
  }

  .chapter-facts {
    position: relative;
    bottom: auto;
    left: auto;
    margin-top: 42px;
  }

  .chapter-stamp {
    width: 54px;
    height: 54px;
  }

  .thumb-rail {
    top: auto;
    right: 14px;
    bottom: 88px;
    left: 14px;
    width: auto;
    height: 72px;
    grid-auto-flow: column;
    grid-auto-columns: 46px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 10px 30px;
  }

  .thumb-rail::before,
  .thumb-rail::after {
    right: 16px;
    left: 16px;
    width: auto;
    height: 5px;
    background: repeating-linear-gradient(
      90deg,
      rgba(255, 246, 231, 0.32) 0 4px,
      transparent 4px 12px
    );
  }

  .thumb-rail::before {
    top: 3px;
    bottom: auto;
  }

  .thumb-rail::after {
    top: auto;
    bottom: 3px;
  }

  .thumb-rail button {
    width: 46px;
    height: 52px;
  }

  .photo-counter {
    right: 86px;
    bottom: 62px;
  }

  figcaption {
    right: 86px;
    bottom: 20px;
    left: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chapter-cover,
  .photo-stage,
  .photo-swap-enter-active,
  .photo-swap-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
