<template>
  <article class="photo-card" :class="{ 'photo-card-wall': variant === 'wall' }" :data-photo-id="photo.id" :style="cardStyle">
    <div class="image-frame" :class="imageFrameClass" :style="imageFrameStyle">
      <button class="image-button" type="button" @click="$emit('preview', photo)" @dragstart.prevent>
        <img
          ref="imageRef"
          :src="cardImageUrl"
          :alt="photo.title"
          :width="photo.width || undefined"
          :height="photo.height || undefined"
          loading="lazy"
          draggable="false"
          @dragstart.prevent
          @load="markImageLoaded"
          @error="markImageLoaded"
        />
      </button>

      <div class="photo-overlays" :class="{ 'exif-mode': exifHovered && showExifControl }">
        <div v-if="photo.isFeatured || photo.isPinned" class="status-actions">
          <span v-if="photo.isFeatured" class="status-icon featured-star" aria-label="精选" title="精选">
            <el-icon><Star /></el-icon>
          </span>
          <span v-if="photo.isPinned" class="status-icon pinned-icon" aria-label="置顶" title="置顶">
            <el-icon><Top /></el-icon>
          </span>
        </div>
        <div v-if="photo.tags?.length" class="overlay-tags" :class="{ 'with-status': photo.isFeatured || photo.isPinned }">
          <router-link v-for="item in photo.tags.slice(0, 3)" :key="item.tag.id" :to="{ path: '/photos', query: { tagId: item.tag.id } }" @click.stop>
            #{{ item.tag.name }}
          </router-link>
        </div>
        <button
          v-if="showExifControl"
          class="overlay-pill exif-trigger"
          type="button"
          :aria-pressed="exifHovered"
          @mouseenter="exifHovered = true"
          @mouseleave="exifHovered = false"
          @focus="exifHovered = true"
          @blur="exifHovered = false"
          @click.stop="exifHovered = true"
        >
          Exif
        </button>
        <div v-if="hasPhotoExif" class="capture-overlay" :class="{ detailed: exifHovered && showExifControl }">
          <template v-if="exifHovered && showExifControl">
            <span v-for="line in exifLines" :key="line">{{ line }}</span>
          </template>
          <span v-else>{{ equipmentLabel }}</span>
        </div>
      </div>
    </div>

    <div class="card-body">
      <button class="title" type="button" @click="$emit('detail', photo)">{{ photo.title }}</button>
      <div class="card-footer">
        <time>{{ formatDate(photo.takenAt || photo.uploadedAt) }}</time>
        <span>{{ numberText(photo.viewCount) }} 浏览</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Star, Top } from '@element-plus/icons-vue';
import { useSettingsStore } from '../../stores/settings.store.js';
import { hasExifInfo } from '../../utils/exif.js';
import { imageUrl } from '../../utils/image.js';
import { formatDate, numberText } from '../../utils/format.js';

const props = defineProps({
  photo: { type: Object, required: true },
  variant: { type: String, default: 'card' },
  loadIndex: { type: Number, default: 0 }
});

const emit = defineEmits(['preview', 'detail', 'loaded']);

const settings = useSettingsStore();
const exifHovered = ref(false);
const imageRef = ref(null);
const imageLoaded = ref(false);

const cardImageUrl = computed(() => {
  const source = props.variant === 'wall'
    ? (props.photo.mediumUrl || props.photo.originalUrl || props.photo.thumbnailUrl)
    : (props.photo.thumbnailUrl || props.photo.mediumUrl || props.photo.originalUrl);
  return imageUrl(source);
});
const photoAspectStyle = computed(() => {
  const width = Number(props.photo.width);
  const height = Number(props.photo.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return {};
  return { '--photo-aspect-ratio': `${width} / ${height}` };
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
  ...photoAspectStyle.value,
  '--image-load-delay': `${loadDelay.value}ms`
}));
const cardRadius = computed(() => {
  const value = Number(settings.settings.waterfallCardRadius);
  return Math.max(0, Math.min(24, Number.isFinite(value) ? Math.round(value) : 4));
});
const cardStyle = computed(() => {
  const radius = `${cardRadius.value}px`;
  return {
    '--photo-card-radius': radius,
    '--photo-image-radius': `${radius} ${radius} 0 0`,
    '--wall-card-radius': radius,
    '--wall-image-radius': `${radius} ${radius} 0 0`
  };
});
const imageFrameClass = computed(() => [
  `load-${loadAnimation.value}`,
  imageLoaded.value ? 'is-loaded' : 'is-loading'
]);
const hasPhotoExif = computed(() => hasExifInfo(props.photo));
const showExifControl = computed(() => settings.settings.showExifOnHover !== false && hasPhotoExif.value);
const equipmentLabel = computed(() => {
  const camera = [props.photo.cameraMake, props.photo.cameraModel].filter(Boolean).join(' ');
  return camera || props.photo.lensModel || '暂无设备信息';
});
const exifLines = computed(() => [
  equipmentLabel.value,
  props.photo.lensModel ? `镜头 ${props.photo.lensModel}` : null,
  props.photo.aperture ? `光圈 f/${props.photo.aperture}` : null,
  props.photo.focalLength ? `焦段 ${props.photo.focalLength}mm` : null,
  props.photo.iso ? `ISO ${props.photo.iso}` : null,
  props.photo.shutterSpeed ? `快门 ${props.photo.shutterSpeed}` : null
].filter(Boolean));

const markImageLoaded = () => {
  if (imageLoaded.value) return;
  imageLoaded.value = true;
  emit('loaded', props.photo);
};

const checkCachedImage = async () => {
  await nextTick();
  const image = imageRef.value;
  if (image?.complete) markImageLoaded();
};

watch(cardImageUrl, () => {
  imageLoaded.value = false;
  checkCachedImage();
});

onMounted(checkCachedImage);
</script>

<style scoped>
.photo-card {
  --photo-image-radius: var(--photo-card-radius, var(--radius)) var(--photo-card-radius, var(--radius)) 0 0;
  display: inline-block;
  width: 100%;
  margin: 0 0 14px;
  overflow: hidden;
  break-inside: avoid;
  border: 1px solid var(--theme-line);
  border-radius: var(--photo-card-radius, var(--radius));
  background: var(--theme-surface-glass, var(--theme-surface));
  transform-origin: center;
  transition: box-shadow 0.24s ease, border-color 0.24s ease;
}

.photo-card:hover {
  border-color: var(--theme-button-hover-border);
  box-shadow: var(--theme-shadow);
}

.image-frame,
.image-button {
  position: relative;
}

.image-frame {
  overflow: hidden;
  isolation: isolate;
  container-type: inline-size;
  border-radius: var(--photo-image-radius);
  --overlay-edge: clamp(6px, 4cqw, 12px);
  --overlay-edge-hover: clamp(9px, 5.6cqw, 17px);
  --overlay-current-edge: var(--overlay-edge);
  --overlay-gap: clamp(4px, 2.5cqw, 8px);
  --overlay-control-size: clamp(28px, 13cqw, 36px);
  --overlay-font-size: clamp(10px, 4.4cqw, 12px);
  --overlay-icon-size: clamp(15px, 7cqw, 18px);
  --overlay-tag-font-size: clamp(10px, 4.2cqw, 12px);
  --overlay-tag-pad-x: clamp(6px, 3.4cqw, 9px);
  --overlay-tag-pad-y: clamp(3px, 1.8cqw, 4px);
  --overlay-exif-width: clamp(42px, 20cqw, 56px);
  --overlay-status-width: calc(var(--overlay-control-size) * 2 + var(--overlay-gap));
}

.image-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--photo-image-radius);
  background:
    linear-gradient(110deg, transparent 0%, var(--theme-image-skeleton-sheen) 44%, transparent 74%),
    var(--theme-image-skeleton-base);
  background-size: 220% 100%;
  opacity: 1;
  pointer-events: none;
  transition: opacity 0.26s ease;
  animation: imageSkeleton 1.35s ease-in-out infinite;
}

.image-frame.is-loaded::before,
.image-frame.load-none::before {
  opacity: 0;
  animation: none;
}

.image-button {
  display: block;
  width: 100%;
  aspect-ratio: var(--photo-aspect-ratio, auto);
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: var(--photo-image-radius);
  opacity: var(--image-load-opacity, 1);
  filter: var(--image-load-filter, none);
  transform: var(--image-load-transform, none);
  transition:
    opacity var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease),
    transform var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease),
    filter var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease);
  transition-delay: var(--image-load-delay, 0ms);
}

.image-frame.is-loaded .image-button,
.image-frame.load-none .image-button {
  opacity: 1;
  filter: none;
  transform: none;
}

.image-frame.is-loading .photo-overlays {
  opacity: 0;
}

.image-frame:hover,
.image-frame:focus-within {
  --overlay-current-edge: var(--overlay-edge-hover);
}

.image-frame.load-blur {
  --image-load-opacity: 1;
  --image-load-filter: blur(18px);
}

.image-frame.load-blur::before {
  display: none;
}

.image-frame.load-blur .image-button {
  transition: filter var(--waterfall-load-duration, 720ms) var(--image-load-easing, ease);
  transition-delay: var(--image-load-delay, 0ms);
}

.image-frame.load-custom {
  --image-load-opacity: var(--waterfall-custom-load-opacity, 0);
  --image-load-filter: var(--waterfall-custom-load-filter, blur(18px));
  --image-load-transform: var(--waterfall-custom-load-transform, scale(0.985));
  --image-load-easing: var(--waterfall-custom-load-easing, ease);
}

.image-button::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  border-radius: var(--photo-image-radius);
  opacity: 0;
  box-shadow:
    inset 0 0 0 1px var(--theme-image-hover-ring),
    inset 0 18px 42px var(--theme-image-hover-top-shadow),
    inset 0 -22px 58px var(--theme-image-hover-bottom-shadow);
  transition: opacity 0.28s ease;
}

.image-button img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: var(--photo-image-radius);
  user-select: none;
  -webkit-user-drag: none;
  transform: scale(1);
  transition: transform 0.32s ease, filter 0.32s ease;
  will-change: transform;
}

@keyframes imageSkeleton {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

@keyframes exifLineIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.photo-overlays {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  contain: paint;
  pointer-events: none;
}

.image-frame:hover .image-button::after {
  opacity: 1;
}

.image-frame:hover .image-button img {
  transform: scale(0.965);
  filter: brightness(0.86) saturate(1.06);
}

.overlay-pill {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: clamp(3px, 2cqw, 5px);
  min-height: var(--overlay-control-size);
  border: 1px solid var(--theme-image-overlay-border);
  border-radius: 999px;
  color: var(--theme-image-overlay-text);
  background: var(--theme-image-overlay-bg);
  box-shadow:
    inset 0 1px 0 var(--theme-image-hover-ring),
    var(--theme-image-overlay-shadow);
  opacity: 0.66;
  transform: none;
  font-size: var(--overlay-font-size);
  transition: opacity 0.22s ease, transform 0.22s ease, background 0.22s ease, color 0.22s ease;
  pointer-events: auto;
}

.image-frame:hover .overlay-pill,
.overlay-pill:focus-visible {
  opacity: 1;
}

.status-actions {
  position: absolute;
  z-index: 2;
  top: var(--overlay-current-edge);
  left: var(--overlay-current-edge);
  display: flex;
  align-items: center;
  gap: var(--overlay-gap);
  transition: top 0.24s ease, left 0.24s ease, gap 0.24s ease;
}

.status-icon {
  width: var(--overlay-control-size);
  height: var(--overlay-control-size);
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

.status-icon :deep(svg) {
  width: var(--overlay-icon-size);
  height: var(--overlay-icon-size);
  stroke-width: 1.8;
}

.pinned-icon {
  color: var(--theme-image-overlay-text);
}

.overlay-tags {
  position: absolute;
  z-index: 2;
  top: var(--overlay-current-edge);
  right: var(--overlay-current-edge);
  max-width: calc(100% - var(--overlay-current-edge) * 2);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: clamp(4px, 2.2cqw, 6px);
  opacity: 0;
  transform: translateX(5px);
  transition: top 0.24s ease, right 0.24s ease, opacity 0.22s ease, transform 0.22s ease;
  will-change: opacity, transform;
  pointer-events: auto;
}

.image-frame:hover .overlay-tags,
.overlay-tags:focus-within {
  opacity: 1;
  transform: none;
}

.overlay-tags.with-status {
  max-width: max(42%, calc(100% - var(--overlay-current-edge) * 3 - var(--overlay-status-width)));
}

.overlay-tags a {
  max-width: 100%;
  overflow: hidden;
  padding: var(--overlay-tag-pad-y) var(--overlay-tag-pad-x);
  border: 1px solid var(--theme-image-overlay-border);
  border-radius: 999px;
  color: var(--theme-image-overlay-text);
  background: var(--theme-image-overlay-bg);
  box-shadow:
    inset 0 1px 0 var(--theme-image-hover-ring),
    var(--theme-image-overlay-shadow);
  font-size: var(--overlay-tag-font-size);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.overlay-tags a:hover {
  border-color: var(--theme-image-overlay-border-strong);
  color: var(--theme-lightbox-text);
  background: var(--theme-image-overlay-bg-strong);
}

.exif-trigger {
  display: inline-grid;
  place-items: center;
  right: var(--overlay-current-edge);
  bottom: var(--overlay-current-edge);
  min-width: var(--overlay-exif-width);
  padding: 0 clamp(8px, 4cqw, 11px);
  cursor: default;
  font-size: var(--overlay-font-size);
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(5px);
  transition: right 0.24s ease, bottom 0.24s ease, opacity 0.22s ease, transform 0.22s ease, background 0.22s ease, color 0.22s ease;
}

.image-frame :is(a, button, img) {
  cursor: pointer;
}

.capture-overlay {
  position: absolute;
  z-index: 2;
  right: calc(var(--overlay-current-edge) + var(--overlay-exif-width) + var(--overlay-gap));
  bottom: calc(var(--overlay-current-edge) + 1px);
  left: var(--overlay-current-edge);
  max-height: calc(100% - var(--overlay-current-edge) * 2 - var(--overlay-control-size) - var(--overlay-gap));
  overflow: hidden;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
  gap: clamp(3px, 1.8cqw, 4px);
  color: var(--theme-image-overlay-muted);
  font-size: var(--overlay-font-size);
  line-height: 1.45;
  opacity: 0;
  transform: translateY(5px);
  transition: left 0.24s ease, right 0.24s ease, bottom 0.24s ease, opacity 0.22s ease, transform 0.22s ease;
  pointer-events: none;
}

.capture-overlay span {
  display: block;
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
  padding: clamp(2px, 1.4cqw, 3px) clamp(5px, 3cqw, 7px);
  border-radius: 4px;
  background: var(--theme-image-overlay-chip-bg);
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.capture-overlay.detailed {
  right: var(--overlay-current-edge);
  max-height: min(72%, calc(100% - var(--overlay-current-edge) * 2));
  gap: clamp(2px, 1.3cqw, 3px);
  line-height: 1.18;
}

.capture-overlay.detailed span {
  max-width: min(100%, 240px);
  padding: clamp(1px, 1cqw, 2px) clamp(5px, 2.4cqw, 7px);
  background: var(--theme-image-overlay-chip-bg-strong);
  opacity: 0;
  transform: translateY(6px);
  animation: exifLineIn 0.34s cubic-bezier(0.2, 0.72, 0.22, 1) both;
}

.capture-overlay.detailed span:nth-child(2) {
  animation-delay: 28ms;
}

.capture-overlay.detailed span:nth-child(3) {
  animation-delay: 56ms;
}

.capture-overlay.detailed span:nth-child(4) {
  animation-delay: 84ms;
}

.capture-overlay.detailed span:nth-child(5) {
  animation-delay: 112ms;
}

.capture-overlay.detailed span:nth-child(6) {
  animation-delay: 140ms;
}

.image-frame:hover .capture-overlay {
  opacity: 1;
  transform: translateY(0);
}

.photo-overlays.exif-mode .status-actions,
.photo-overlays.exif-mode .overlay-tags {
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
}

.photo-overlays.exif-mode .exif-trigger {
  opacity: 0;
}

.photo-overlays.exif-mode .capture-overlay {
  opacity: 1;
  transform: translateY(0);
}

.card-body {
  padding: 12px;
}

.title {
  display: block;
  width: 100%;
  margin: 0 0 8px;
  padding: 0;
  overflow: hidden;
  border: 0;
  color: var(--theme-text);
  background: transparent;
  font: inherit;
  font-weight: 800;
  line-height: 1.35;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.title:hover {
  color: var(--theme-primary);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: var(--theme-muted-strong);
  font-size: 12px;
}

.card-footer span {
  color: var(--theme-muted);
}

.photo-card-wall {
  --wall-card-radius: var(--waterfall-card-radius, 4px);
  --wall-image-radius: var(--wall-card-radius) var(--wall-card-radius) 0 0;
  --photo-image-radius: var(--wall-image-radius);
  margin-bottom: clamp(5px, 0.45vw, 9px);
  border: 1px solid var(--theme-line-faint);
  border-radius: var(--wall-card-radius);
  background: var(--theme-wall-card-bg);
}

.photo-card-wall:hover {
  box-shadow: var(--theme-shadow);
}

.photo-card-wall .image-frame,
.photo-card-wall .image-button,
.photo-card-wall .image-button img {
  border-radius: var(--wall-image-radius);
}

.photo-card-wall .image-frame::before,
.photo-card-wall .image-button::after {
  border-radius: var(--wall-image-radius);
}

.photo-card-wall .card-body {
  position: static;
  min-height: 62px;
  padding: 10px 10px 12px;
  color: var(--theme-wall-card-text);
  background: var(--theme-wall-card-body-bg);
}

.photo-card-wall .title {
  margin-bottom: 7px;
  color: var(--theme-wall-card-text);
}

.photo-card-wall .title:hover {
  color: var(--theme-primary);
}

.photo-card-wall .card-footer {
  color: var(--theme-wall-card-muted);
  font-size: 12px;
}

.photo-card-wall .card-footer span {
  color: var(--theme-muted);
}

@container (max-width: 190px) {
  .image-frame {
    --overlay-edge: 6px;
    --overlay-edge-hover: 8px;
    --overlay-gap: 4px;
    --overlay-control-size: 28px;
    --overlay-font-size: 10px;
    --overlay-tag-font-size: 10px;
    --overlay-exif-width: 42px;
  }

  .overlay-tags a:nth-child(n + 3) {
    display: none;
  }

  .capture-overlay span {
    max-width: calc(100% - 4px);
  }

  .capture-overlay.detailed {
    max-height: 62%;
  }
}

@container (max-width: 155px) {
  .overlay-tags.with-status {
    max-width: 46%;
  }

  .overlay-tags a:nth-child(n + 2) {
    display: none;
  }

  .capture-overlay {
    right: calc(var(--overlay-current-edge) + var(--overlay-exif-width) + 3px);
  }

  .capture-overlay.detailed {
    right: var(--overlay-current-edge);
    max-height: 56%;
  }

  .capture-overlay.detailed span:nth-child(n + 6) {
    display: none;
  }
}

@media (hover: none) {
  .photo-card .overlay-tags,
  .photo-card .exif-trigger,
  .photo-card .capture-overlay {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-frame::before {
    animation: none;
  }

  .image-button {
    transition: none;
  }

  .capture-overlay.detailed span {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
