<template>
  <LoadingState v-if="loading" />
  <EmptyState v-else-if="!wallItems.length" title="还没有照片" description="上传照片后，它们会出现在这里。" />
  <div
    v-else
    ref="wallRef"
    class="waterfall"
    :class="[`waterfall-${variant}`, { 'waterfall-reflowing': isReflowing, 'waterfall-full-bleed': isFullBleed }]"
    :style="waterfallStyle"
  >
    <div v-for="(column, columnIndex) in columns" :key="columnIndex" class="waterfall-column">
      <div
        v-for="item in column"
        :key="item.key"
        class="waterfall-item"
        :class="{ 'waterfall-item-enter-pending': pendingEnterKeys.has(item.key) }"
        :data-waterfall-key="item.key"
      >
        <WaterfallAlbumCard v-if="item.type === 'album'" :album="item.data" :load-index="item.loadIndex" @preview="openAlbumPreview" @detail="openAlbumDetail" />
        <PhotoCard
          v-else
          :photo="item.data"
          :variant="variant"
          :load-index="item.loadIndex"
          @preview="emit('preview', item.data)"
          @detail="openDetail"
        />
      </div>
      <WaterfallCreditCard v-if="showCreditCard && columnIndex === creditColumnIndex" class="waterfall-credit-item" />
    </div>
  </div>
  <PhotoDetailSheet
    :visible="detailVisible"
    :photo-id="detailPhoto?.id || null"
    :initial-photo="detailPhoto"
    @close="detailVisible = false"
    @updated="syncPhoto"
  />
  <AlbumDetailSheet
    :visible="albumDetailVisible"
    :album-id="detailAlbum?.id || null"
    :initial-album="detailAlbum"
    @close="albumDetailVisible = false"
  />
  <PhotoLightbox
    v-model:index="albumLightboxIndex"
    :visible="albumLightboxVisible"
    :photos="albumLightboxPhotos"
    :origin-selector="albumOriginSelector"
    navigation
    @close="albumLightboxVisible = false"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ElMessage } from 'element-plus';
import { albumApi } from '../../api/album.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import WaterfallCreditCard from '../common/WaterfallCreditCard.vue';
import WaterfallAlbumCard from '../album/WaterfallAlbumCard.vue';
import AlbumDetailSheet from '../album/AlbumDetailSheet.vue';
import PhotoCard from './PhotoCard.vue';
import PhotoDetailSheet from './PhotoDetailSheet.vue';
import PhotoLightbox from './PhotoLightbox.vue';

const props = defineProps({
  photos: { type: Array, default: () => [] },
  albums: { type: Array, default: () => [] },
  includeAlbums: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  variant: { type: String, default: 'card' },
  animateInitial: { type: Boolean, default: false },
  showCreditCard: { type: Boolean, default: false }
});

const emit = defineEmits(['preview']);

const settings = useSettingsStore();
const wallRef = ref(null);
const columns = ref([]);
const creditColumnIndex = ref(-1);
const resolvedColumns = ref(props.variant === 'wall' ? 5 : 3);
const isReflowing = ref(false);
const pendingEnterKeys = ref(new Set());
const detailVisible = ref(false);
const detailPhoto = ref(null);
const albumDetailVisible = ref(false);
const detailAlbum = ref(null);
const albumLightboxVisible = ref(false);
const albumLightboxPhotos = ref([]);
const albumLightboxIndex = ref(0);
const albumOriginSelector = ref('');
let resizeObserver = null;
let enterObserver = null;
let resizeTimer = null;
let flipTween = null;
let resizeListening = false;
let albumPreviewRequest = 0;

gsap.registerPlugin(Flip);

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cardsInDom = () => [...(wallRef.value?.querySelectorAll('.waterfall-item') || [])];
const keysFromSignature = (signature = '') => String(signature).split('|').filter(Boolean);
const photoKeysFrom = (keys) => keys.filter((key) => key.startsWith('photo-'));
const isFullBleed = computed(() => props.variant === 'wall' && settings.settings.waterfallFullBleed === true);
const animationDuration = computed(() => Math.max(200, Math.min(1600, Number(settings.settings.waterfallLoadDurationMs) || 720)));
const animationStagger = computed(() => Math.max(0, Math.min(120, Number(settings.settings.waterfallLoadStaggerMs) || 24)));
const cardEnterDistance = computed(() => {
  const width = window.innerWidth || 1280;
  return Math.max(28, Math.min(42, width * 0.026));
});
const waterfallStyle = computed(() => ({
  '--waterfall-columns': resolvedColumns.value,
  '--waterfall-load-duration': `${animationDuration.value}ms`,
  '--waterfall-load-stagger': `${animationStagger.value}ms`,
  '--waterfall-card-enter-y': `${cardEnterDistance.value}px`
}));
const withLoadIndex = (items) => items.map((item, index) => ({ ...item, loadIndex: index }));

const wallItems = computed(() => {
  const photoItems = props.photos.map((photo) => ({ type: 'photo', key: `photo-${photo.id}`, data: photo }));
  if (!props.includeAlbums || !props.albums.length) return withLoadIndex(photoItems);
  const albumItems = props.albums.map((album) => ({ type: 'album', key: `album-${album.id}`, data: album }));
  const mixed = [];
  let albumIndex = 0;
  photoItems.forEach((item, index) => {
    mixed.push(item);
    if ((index + 1) % 8 === 0 && albumItems[albumIndex]) {
      mixed.push(albumItems[albumIndex]);
      albumIndex += 1;
    }
  });
  return withLoadIndex([...mixed, ...albumItems.slice(albumIndex)]);
});

const configuredColumns = () => {
  const raw = settings.settings.waterfallColumns;
  if (raw === undefined || raw === null || raw === '' || raw === 'auto') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
};

const autoColumns = (width) => {
  const target = props.variant === 'wall' ? 205 : 280;
  const max = props.variant === 'wall' ? 8 : 5;
  return Math.max(1, Math.min(max, Math.floor(width / target)));
};

const getColumnCount = () => {
  const width = wallRef.value?.clientWidth || 0;
  if (!width) return resolvedColumns.value;
  const minimum = props.variant === 'wall' ? 150 : 210;
  const maxByWidth = Math.max(1, Math.floor(width / minimum));
  const selected = configuredColumns();
  if (selected) return Math.max(1, Math.min(selected, maxByWidth));
  return autoColumns(width);
};

const estimateHeight = (item) => {
  const photo = item.type === 'album' ? (item.data.coverPhoto || item.data.photos?.[0] || {}) : item.data;
  const width = Number(photo.width) || 1600;
  const height = Number(photo.height) || 1800;
  const imageRatio = Math.max(0.62, Math.min(1.9, height / width));
  const bodyRatio = item.type === 'album' ? 0.52 : (props.variant === 'wall' ? 0.3 : 0.27);
  return imageRatio + bodyRatio;
};

const distributePhotos = (items, count) => {
  const nextColumns = Array.from({ length: Math.max(1, count) }, () => []);
  const heights = Array.from({ length: Math.max(1, count) }, () => 0);

  items.forEach((item) => {
    let target = 0;
    for (let index = 1; index < heights.length; index += 1) {
      if (heights[index] < heights[target]) target = index;
    }
    nextColumns[target].push(item);
    heights[target] += estimateHeight(item);
  });

  if (props.showCreditCard && nextColumns.length) {
    let shortest = 0;
    for (let index = 1; index < heights.length; index += 1) {
      if (heights[index] < heights[shortest]) shortest = index;
    }
    creditColumnIndex.value = shortest;
  } else {
    creditColumnIndex.value = -1;
  }

  return nextColumns;
};

const runFlip = async (state, duration = 1.12) => {
  await nextTick();
  const cards = cardsInDom();
  if (!state || !cards.length || reducedMotion()) return;
  flipTween?.kill();
  isReflowing.value = true;
  flipTween = Flip.from(state, {
    targets: cards,
    absolute: false,
    scale: false,
    nested: true,
    prune: true,
    duration,
    ease: 'power2.inOut',
    stagger: { each: 0.005, from: 'start' },
    onComplete: () => {
      isReflowing.value = false;
      flipTween = null;
    }
  });
};

const removePendingKey = (key) => {
  if (!pendingEnterKeys.value.has(key)) return;
  const next = new Set(pendingEnterKeys.value);
  next.delete(key);
  pendingEnterKeys.value = next;
};

const revealPendingCard = (card) => {
  const key = card.dataset.waterfallKey;
  if (!key || !pendingEnterKeys.value.has(key)) return;
  enterObserver?.unobserve(card);

  if (reducedMotion()) {
    removePendingKey(key);
    return;
  }

  removePendingKey(key);
  card.classList.remove('waterfall-item-enter-pending');
  const duration = Math.max(1.25, Math.min(2.25, animationDuration.value / 1000 * 1.65));
  gsap.fromTo(
    card,
    {
      y: cardEnterDistance.value,
      scale: 0.992,
      force3D: true
    },
    {
      y: 0,
      scale: 1,
      duration,
      ease: 'expo.out',
      overwrite: 'auto',
      clearProps: 'transform'
    }
  );
};

const observePendingEnterCards = async (keys) => {
  await nextTick();
  if (!keys.length || reducedMotion()) {
    pendingEnterKeys.value = new Set();
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    keys.forEach((key) => {
      const card = wallRef.value?.querySelector(`[data-waterfall-key="${CSS.escape(key)}"]`);
      if (card) revealPendingCard(card);
    });
    return;
  }

  enterObserver ??= new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((entry, index) => {
          window.setTimeout(() => revealPendingCard(entry.target), index * Math.max(48, Math.min(130, animationStagger.value * 1.45 || 64)));
        });
    },
    {
      root: null,
      rootMargin: '0px 0px 10% 0px',
      threshold: 0.01
    }
  );

  keys.forEach((key) => {
    const card = wallRef.value?.querySelector(`[data-waterfall-key="${CSS.escape(key)}"]`);
    if (card) enterObserver.observe(card);
  });
};

const applyColumns = async ({ animateLayout = false } = {}) => {
  const state = animateLayout && cardsInDom().length ? Flip.getState(cardsInDom()) : null;
  columns.value = distributePhotos(wallItems.value, resolvedColumns.value);
  await nextTick();
  if (state) await runFlip(state, 1.18);
};

const updateColumns = async (animate = true) => {
  if (!wallRef.value) return;
  const nextColumns = getColumnCount();
  const changed = nextColumns !== resolvedColumns.value;
  if (!changed) return;
  resolvedColumns.value = nextColumns;
  await applyColumns({ animateLayout: animate });
};

const requestColumnUpdate = (animate = true) => {
  if (resizeTimer) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => updateColumns(animate), animate ? 220 : 0);
};

const onWindowResize = () => requestColumnUpdate(true);

const handleItemsChange = async (signature, previousSignature) => {
  const keys = keysFromSignature(signature);
  const previousKeyList = keysFromSignature(previousSignature);
  const previousKeys = new Set(previousKeyList);
  const previousPhotoKeys = photoKeysFrom(previousKeyList);
  const nextPhotoKeys = photoKeysFrom(keys);
  const isPhotoAppend =
    previousPhotoKeys.length > 0 &&
    nextPhotoKeys.length > previousPhotoKeys.length &&
    previousPhotoKeys.every((key) => keys.includes(key));
  const addedKeys = isPhotoAppend
    ? keys.filter((key) => !previousKeys.has(key))
    : (!previousKeyList.length && props.animateInitial ? keys : []);
  pendingEnterKeys.value = addedKeys.length ? new Set(addedKeys) : new Set();
  await applyColumns({ animateLayout: false });
  if (addedKeys.length) await observePendingEnterCards(addedKeys);
};

const openDetail = (photo) => {
  detailPhoto.value = photo;
  detailVisible.value = true;
};

const syncPhoto = (fresh) => {
  const original = props.photos.find((photo) => photo.id === fresh.id);
  if (original) Object.assign(original, fresh);
  if (detailPhoto.value?.id === fresh.id) detailPhoto.value = original || fresh;
};

const openAlbumDetail = (album) => {
  detailAlbum.value = album;
  albumDetailVisible.value = true;
};

const openAlbumPreview = async (album) => {
  const request = ++albumPreviewRequest;
  const result = await albumApi.detail(album.id);
  if (request !== albumPreviewRequest) return;
  const photos = result.data.photos || [];
  if (!photos.length) {
    ElMessage.info('该相册暂无可预览照片');
    return;
  }
  const coverId = album.coverPhoto?.id || album.photos?.[0]?.id;
  const coverIndex = photos.findIndex((photo) => photo.id === coverId);
  albumLightboxPhotos.value = photos;
  albumLightboxIndex.value = coverIndex >= 0 ? coverIndex : 0;
  albumOriginSelector.value = `.wall-album-card[data-album-id="${Number(album.id)}"] .album-image img`;
  albumLightboxVisible.value = true;
};

const observeWall = async () => {
  await nextTick();
  if (!wallRef.value) return;
  resizeObserver?.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => requestColumnUpdate(true));
    resizeObserver.observe(wallRef.value);
  } else if (!resizeListening) {
    window.addEventListener('resize', onWindowResize);
    resizeListening = true;
  }
  await updateColumns(false);
};

watch(() => wallItems.value.map((item) => item.key).join('|'), handleItemsChange, { immediate: true, flush: 'post' });
watch(wallRef, observeWall, { flush: 'post' });
watch(() => [props.loading, props.variant], () => requestColumnUpdate(false), { flush: 'post' });
watch(() => settings.settings.waterfallColumns, () => requestColumnUpdate(true));
watch(() => settings.settings.waterfallFullBleed, () => requestColumnUpdate(true));

onMounted(observeWall);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  enterObserver?.disconnect();
  if (resizeTimer) window.clearTimeout(resizeTimer);
  if (resizeListening) window.removeEventListener('resize', onWindowResize);
  flipTween?.kill();
});
</script>

<style scoped>
.waterfall {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(var(--waterfall-columns), minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.waterfall-column {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 14px;
}

.waterfall-wall {
  --wall-side-space: clamp(300px, 24vw, 560px);
  width: min(100%, calc(100vw - var(--wall-side-space)));
  margin-inline: auto;
  gap: clamp(5px, 0.42vw, 9px);
}

.waterfall-wall.waterfall-full-bleed {
  width: min(100%, calc(100vw - clamp(12px, 1.4vw, 28px)));
}

.waterfall-wall .waterfall-column {
  gap: clamp(5px, 0.45vw, 9px);
}

.waterfall-reflowing {
  pointer-events: none;
}

.waterfall-reflowing :deep(.photo-card) {
  will-change: transform;
}

:deep(.photo-card) {
  margin-bottom: 0;
}

.waterfall-item {
  min-width: 0;
  transform-origin: center bottom;
}

.waterfall-item-enter-pending {
  visibility: hidden;
  transform: translate3d(0, var(--waterfall-card-enter-y, 36px), 0) scale(0.992);
  will-change: transform;
}

@media (max-width: 760px) {
  .waterfall {
    gap: 8px;
  }

  .waterfall-column {
    gap: 8px;
  }

  .waterfall-wall {
    width: 100%;
    gap: 6px;
  }

  .waterfall-wall .waterfall-column {
    gap: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waterfall-item-enter-pending {
    visibility: visible;
    transform: none;
  }
}
</style>
