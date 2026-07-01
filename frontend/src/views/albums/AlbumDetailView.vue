<template>
  <LoadingState v-if="loading" class="chapter-loading" />

  <main v-else-if="album" class="album-chapter-page" :style="chapterStyle">
    <header class="chapter-nav">
      <button type="button" @click="router.push({ name: 'albums' })">
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
      >
        <template v-if="photos.length">
          <Transition name="photo-swap" mode="out-in">
            <figure :key="currentPhoto?.id || currentIndex" class="chapter-photo">
              <button class="photo-button" type="button" @click="openLightbox(currentIndex)">
                <img
                  :src="photoImageUrl(currentPhoto, ['mediumUrl', 'smallUrl', 'thumbnailUrl', 'originalUrl'])"
                  :srcset="photoImageSrcset(currentPhoto, ['thumbnailUrl', 'smallUrl', 'mediumUrl']) || undefined"
                  :sizes="photoImageSizes.hero"
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
                :alt="photo.title"
                loading="lazy"
                @error="handleImageError"
              />
            </button>
          </nav>

          <div class="chapter-controls">
            <button type="button" aria-label="上一张" @click="move(-1)">
              <el-icon><ArrowLeft /></el-icon>
            </button>
            <button type="button" aria-label="下一张" @click="move(1)">
              <el-icon><ArrowRight /></el-icon>
            </button>
            <span>{{ paused ? 'HOVER PAUSES' : 'FLIP PHOTO' }}</span>
          </div>
        </template>

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
import { ArrowLeft, ArrowRight, Back } from '@element-plus/icons-vue';
import { albumApi } from '../../api/album.api.js';
import LoadingState from '../../components/common/LoadingState.vue';
import EmptyState from '../../components/common/EmptyState.vue';
import PhotoLightbox from '../../components/photo/PhotoLightbox.vue';
import { handleImageError, photoImageSizes, photoImageSrcset, photoImageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';

const route = useRoute();
const router = useRouter();
const album = ref(null);
const loading = ref(true);
const currentIndex = ref(0);
const lightboxVisible = ref(false);
const lightboxIndex = ref(0);
const paused = ref(false);
let autoTimer = null;

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

const openLightbox = (index) => {
  lightboxIndex.value = index;
  lightboxVisible.value = true;
  paused.value = true;
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

const load = async () => {
  loading.value = true;
  try {
    const res = await albumApi.detail(route.params.id);
    album.value = res.data;
    currentIndex.value = 0;
  } finally {
    loading.value = false;
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
});
</script>

<style scoped>
.chapter-loading {
  width: min(820px, calc(100% - 28px));
  margin: 22dvh auto 0;
}

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
  grid-template-columns: minmax(360px, 51vw) minmax(0, 1fr);
}

.chapter-cover {
  position: relative;
  min-height: 100dvh;
  padding: clamp(92px, 13vh, 132px) clamp(30px, 5vw, 58px) clamp(34px, 6vh, 62px);
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
.chapter-stamp,
.chapter-controls {
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
  max-width: 8.8ch;
  margin: 0;
  color: #080706;
  font-size: clamp(60px, 10vw, 132px);
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
  max-width: 430px;
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
  bottom: clamp(88px, 14vh, 132px);
  left: clamp(30px, 5vw, 58px);
  display: grid;
  gap: 8px;
  color: rgba(8, 7, 6, 0.72);
  font-size: 12px;
  font-weight: 900;
}

blockquote {
  position: absolute;
  z-index: 1;
  right: clamp(28px, 4vw, 54px);
  bottom: clamp(84px, 14vh, 130px);
  width: min(270px, 42%);
  margin: 0;
  color: rgba(8, 7, 6, 0.72);
  font-size: 12px;
  font-weight: 900;
  line-height: 1.7;
}

.chapter-stamp {
  position: absolute;
  right: clamp(34px, 5vw, 70px);
  bottom: clamp(30px, 6vh, 54px);
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
  right: clamp(36px, 8vw, 116px);
  bottom: clamp(28px, 5vh, 46px);
  z-index: 3;
  display: grid;
  gap: 6px;
  color: rgba(255, 246, 231, 0.88);
  font-family: "Courier New", monospace;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  text-shadow: 0 3px 18px rgba(0, 0, 0, 0.7);
}

figcaption em {
  color: rgba(255, 246, 231, 0.62);
  font-style: normal;
}

.photo-counter {
  position: absolute;
  right: clamp(24px, 3vw, 42px);
  bottom: clamp(20px, 4vh, 36px);
  z-index: 3;
  color: rgba(255, 246, 231, 0.94);
  font-size: clamp(42px, 6vw, 82px);
  font-weight: 950;
  line-height: 0.85;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.72);
}

.thumb-rail {
  position: absolute;
  top: 72px;
  right: 12px;
  bottom: 96px;
  z-index: 4;
  width: 52px;
  display: grid;
  align-content: start;
  gap: 7px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: none;
}

.thumb-rail::-webkit-scrollbar {
  width: 0;
}

.thumb-rail button {
  width: 44px;
  height: 54px;
  overflow: hidden;
  padding: 0;
  border: 1px solid rgba(255, 246, 231, 0.15);
  border-radius: 1px;
  background: #111;
  cursor: pointer;
  opacity: 0.54;
  transition: opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.thumb-rail button.active,
.thumb-rail button:hover,
.thumb-rail button:focus-visible {
  opacity: 1;
  border-color: var(--chapter-accent);
  transform: translateX(-4px);
}

.thumb-rail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chapter-controls {
  position: absolute;
  bottom: 26px;
  left: 50%;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  color: rgba(244, 234, 215, 0.64);
  background: rgba(4, 4, 4, 0.76);
  border: 1px solid rgba(244, 234, 215, 0.13);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.38);
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.chapter-controls button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(244, 234, 215, 0.12);
  border-radius: 2px;
  color: #f4ead7;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.chapter-controls button:hover,
.chapter-controls button:focus-visible {
  color: #0b0907;
  border-color: var(--chapter-accent);
  background: var(--chapter-accent);
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
    bottom: 82px;
    left: 14px;
    width: auto;
    grid-auto-flow: column;
    grid-auto-columns: 46px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .thumb-rail button {
    width: 46px;
  }

  .photo-counter {
    right: 16px;
    bottom: 18px;
  }

  figcaption {
    right: 80px;
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
