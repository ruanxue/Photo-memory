<template>
  <article class="wall-album-card" :data-album-id="album.id">
    <button
      class="album-image"
      :class="imageFrameClass"
      type="button"
      :aria-label="`预览相册 ${album.title}`"
      :style="imageFrameStyle"
      @click="$emit('preview', album)"
      @dragstart.prevent
    >
      <img
        ref="imageRef"
        :src="coverImageUrl"
        :srcset="coverImageSrcset || undefined"
        :sizes="photoImageSizes.wall"
        :alt="album.title"
        :width="coverPhoto?.width || undefined"
        :height="coverPhoto?.height || undefined"
        loading="lazy"
        draggable="false"
        @dragstart.prevent
        @load="markImageLoaded"
        @error="handleCoverImageError"
      />
      <span class="album-count">
        <el-icon><Collection /></el-icon>
        {{ album.photoCount || album.photos?.length || 0 }}
      </span>
      <span v-if="album.isPinned" class="album-pin" aria-label="置顶" title="置顶">
        <el-icon><Top /></el-icon>
      </span>
    </button>
    <div class="album-body">
      <button class="album-title" type="button" @click="$emit('detail', album)">{{ album.title }}</button>
      <p>{{ album.description || '查看相册中的影像记录' }}</p>
    </div>
  </article>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Collection, Top } from '@element-plus/icons-vue';
import { albumCover, albumCoverSrcset, handleImageError, photoImageSizes } from '../../utils/image.js';
import { useSettingsStore } from '../../stores/settings.store.js';

const props = defineProps({
  album: { type: Object, required: true },
  loadIndex: { type: Number, default: 0 }
});

const emit = defineEmits(['preview', 'detail', 'loaded']);

const settings = useSettingsStore();
const imageRef = ref(null);
const imageLoaded = ref(false);
const coverPhoto = computed(() => props.album.coverPhoto || props.album.photos?.[0] || null);
const coverImageUrl = computed(() => albumCover(props.album));
const coverImageSrcset = computed(() => albumCoverSrcset(props.album));
const coverAspectStyle = computed(() => {
  const width = Number(coverPhoto.value?.width);
  const height = Number(coverPhoto.value?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return {};
  return { '--album-cover-aspect-ratio': `${width} / ${height}` };
});
const loadAnimation = computed(() => {
  const value = settings.settings.waterfallLoadAnimation;
  return ['none', 'blur', 'custom'].includes(value) ? value : 'blur';
});
const loadDelay = computed(() => {
  if (loadAnimation.value === 'none') return 0;
  const stagger = Math.max(0, Math.min(120, Number(settings.settings.waterfallLoadStaggerMs) || 24));
  return Math.min(Math.max(0, props.loadIndex) * stagger, 900);
});
const imageFrameStyle = computed(() => ({
  ...coverAspectStyle.value,
  '--image-load-delay': `${loadDelay.value}ms`
}));
const imageFrameClass = computed(() => [
  `load-${loadAnimation.value}`,
  imageLoaded.value ? 'is-loaded' : 'is-loading'
]);

const markImageLoaded = () => {
  if (imageLoaded.value) return;
  imageLoaded.value = true;
  emit('loaded', props.album);
};

const handleCoverImageError = (event) => {
  handleImageError(event);
  markImageLoaded();
};

const checkCachedImage = async () => {
  await nextTick();
  const image = imageRef.value;
  if (image?.complete) markImageLoaded();
};

watch([coverImageUrl, coverImageSrcset], () => {
  imageLoaded.value = false;
  checkCachedImage();
});

onMounted(checkCachedImage);
</script>

<style scoped>
.wall-album-card {
  --wall-card-radius: var(--waterfall-card-radius, 4px);
  --wall-image-radius: var(--wall-card-radius) var(--wall-card-radius) 0 0;
  display: block;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--theme-line-faint);
  border-radius: var(--wall-card-radius);
  background: var(--theme-wall-card-bg);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.wall-album-card:hover {
  border-color: var(--theme-button-hover-border);
  box-shadow: var(--theme-shadow);
}

.album-image {
  position: relative;
  container-type: inline-size;
  --album-marker-edge: clamp(7px, 4cqw, 10px);
  --album-marker-gap: clamp(4px, 2.4cqw, 7px);
  --album-marker-size: clamp(24px, 10cqw, 30px);
  --album-marker-icon-size: clamp(12px, 5.2cqw, 15px);
  display: block;
  width: 100%;
  aspect-ratio: var(--album-cover-aspect-ratio, auto);
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--wall-image-radius);
  background: transparent;
  cursor: pointer;
}

.album-image::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--wall-image-radius);
  background:
    linear-gradient(110deg, transparent 0%, var(--theme-image-skeleton-sheen) 44%, transparent 74%),
    var(--theme-image-skeleton-base);
  background-size: 220% 100%;
  opacity: 1;
  pointer-events: none;
  transition: opacity 0.26s ease;
  animation: albumImageSkeleton 1.35s ease-in-out infinite;
}

.album-image.is-loaded::before,
.album-image.load-none::before {
  opacity: 0;
  animation: none;
}

.album-image::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: var(--wall-image-radius);
  background: var(--theme-image-hover-scrim);
  opacity: 0;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px var(--theme-image-hover-ring),
    inset 0 20px 44px var(--theme-image-hover-top-shadow),
    inset 0 -24px 64px var(--theme-image-hover-bottom-shadow);
  transition: opacity 0.28s ease;
}

.album-image img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: var(--wall-image-radius);
  user-select: none;
  -webkit-user-drag: none;
  opacity: var(--image-load-opacity, 1);
  filter: var(--image-load-filter, none);
  transform: var(--image-load-transform, none);
  transform-origin: center;
  transition:
    opacity var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease),
    transform var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease),
    filter var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease);
  transition-delay: var(--image-load-delay, 0ms);
}

.album-image.is-loaded img,
.album-image.load-none img {
  opacity: 1;
  filter: none;
  transform: none;
  transition-delay: 0ms;
}

.album-image.is-loading .album-count,
.album-image.is-loading .album-pin {
  opacity: 0;
}

.album-image.load-blur {
  --image-load-opacity: 1;
  --image-load-filter: blur(18px);
}

.album-image.load-blur::before {
  display: none;
}

.album-image.load-blur img {
  transition: filter var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease);
  transition-delay: var(--image-load-delay, 0ms);
}

.album-image.load-custom {
  --image-load-opacity: var(--waterfall-custom-load-opacity, 0);
  --image-load-filter: var(--waterfall-custom-load-filter, blur(18px));
  --image-load-transform: var(--waterfall-custom-load-transform, scale(0.985));
  --image-load-easing: var(--waterfall-custom-load-easing, ease);
}

.album-image:hover img,
.album-image:focus-visible img {
  transform: scale(0.965);
  filter: brightness(0.86) saturate(1.06);
  transition: transform 0.32s ease, filter 0.32s ease;
}

@keyframes albumImageSkeleton {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

.album-image:hover::after,
.album-image:focus-visible::after {
  opacity: 1;
}

.album-count {
  position: absolute;
  z-index: 2;
  top: var(--album-marker-edge);
  left: var(--album-marker-edge);
  min-height: var(--album-marker-size);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 clamp(8px, 4cqw, 10px);
  border: 1px solid var(--theme-image-overlay-border);
  border-radius: 999px;
  color: var(--theme-image-overlay-text);
  background: var(--theme-image-overlay-chip-bg);
  backdrop-filter: blur(10px);
  font-size: clamp(11px, 4.6cqw, 12px);
  transition: opacity 0.22s ease;
}

.album-count :deep(svg) {
  width: var(--album-marker-icon-size);
  height: var(--album-marker-icon-size);
}

.album-pin {
  position: absolute;
  z-index: 2;
  top: calc(var(--album-marker-edge) + var(--album-marker-size) + var(--album-marker-gap));
  left: var(--album-marker-edge);
  width: var(--album-marker-size);
  height: var(--album-marker-size);
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-image-overlay-border-strong);
  border-radius: 50%;
  color: var(--theme-image-overlay-text);
  background: var(--theme-image-overlay-bg);
  box-shadow:
    inset 0 1px 0 var(--theme-image-hover-ring),
    var(--theme-image-overlay-shadow);
}

.album-pin :deep(svg) {
  width: var(--album-marker-icon-size);
  height: var(--album-marker-icon-size);
  stroke-width: 1.8;
}

.album-body {
  display: grid;
  gap: 7px;
  min-height: 82px;
  padding: 10px 10px 12px;
  background: var(--theme-wall-card-body-bg);
}

.album-title {
  display: block;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  color: var(--theme-wall-card-text);
  background: transparent;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.album-title:hover {
  color: var(--theme-primary);
}

p {
  margin: 0;
  overflow: hidden;
  color: var(--theme-wall-card-muted);
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .album-image::before {
    animation: none;
  }

  .album-image img {
    transition: none;
  }
}
</style>
