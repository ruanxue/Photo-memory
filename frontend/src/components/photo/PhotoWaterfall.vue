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
        :class="{ 'waterfall-item-enter-pending': scrollRevealEnabled && pendingEnterKeys.has(item.key) }"
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
    close-animation="corner"
    navigation
    @close="albumLightboxVisible = false"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ElMessage } from 'element-plus/es/components/message/index';
import { albumApi } from '../../api/album.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { albumCover, photoImageUrl } from '../../utils/image.js';
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
  scrollReveal: { type: Boolean, default: true },
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
let observedWallWidth = 0;
let albumPreviewRequest = 0;
let itemsChangeRunId = 0;
let revealQueue = [];
let revealQueueRunning = false;
let revealQueueRunId = 0;
const revealQueueKeys = new Set();
const preloadCache = new Map();

gsap.registerPlugin(Flip);

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cardsInDom = () => [...(wallRef.value?.querySelectorAll('.waterfall-item') || [])];
const keysFromSignature = (signature = '') => String(signature).split('|').filter(Boolean);
const photoKeysFrom = (keys) => keys.filter((key) => key.startsWith('photo-'));
const isFullBleed = computed(() => props.variant === 'wall' && settings.settings.waterfallFullBleed === true);
const animationDuration = computed(() => Math.max(200, Math.min(1600, Number(settings.settings.waterfallLoadDurationMs) || 720)));
const animationStagger = computed(() => Math.max(0, Math.min(120, Number(settings.settings.waterfallLoadStaggerMs) || 24)));
const cardRadius = computed(() => {
  const value = Number(settings.settings.waterfallCardRadius);
  return Math.max(0, Math.min(24, Number.isFinite(value) ? Math.round(value) : 4));
});
const revealAnimation = computed(() => {
  const value = settings.settings.waterfallRevealAnimation;
  return ['slide-up', 'fade', 'none'].includes(value) ? value : 'slide-up';
});
const scrollRevealEnabled = computed(() => props.scrollReveal !== false && revealAnimation.value !== 'none');
const shouldAnimateInitial = computed(() => scrollRevealEnabled.value && (props.animateInitial || props.variant === 'wall'));
const cardEnterDistance = computed(() => {
  const width = window.innerWidth || 1280;
  return Math.max(18, Math.min(34, width * 0.024));
});
const revealDurationSeconds = () => {
  if (revealAnimation.value === 'fade') {
    return Math.max(0.82, Math.min(1.15, animationDuration.value / 1000 * 1.18));
  }
  return Math.max(0.42, Math.min(0.68, animationDuration.value / 1000 * 0.62));
};
const revealEntryDelay = (index) => {
  if (revealAnimation.value === 'fade') return Math.min(index * 8, 40);
  return Math.min(index * 18, 90);
};
const waterfallStyle = computed(() => ({
  '--waterfall-columns': resolvedColumns.value,
  '--waterfall-load-duration': `${animationDuration.value}ms`,
  '--waterfall-load-stagger': `${animationStagger.value}ms`,
  '--waterfall-card-radius': `${cardRadius.value}px`,
  '--waterfall-card-enter-y': `${cardEnterDistance.value}px`,
  '--waterfall-reveal-y': revealAnimation.value === 'fade' ? '0px' : `${cardEnterDistance.value}px`,
  '--waterfall-reveal-opacity': revealAnimation.value === 'fade' ? '0' : '0.96'
}));
const withLoadIndex = (items) => items.map((item, index) => ({ ...item, loadIndex: index }));

const itemTime = (item) => new Date(item.data.createdAt || item.data.uploadedAt || item.data.takenAt || 0).getTime() || 0;

const compareWallOrder = (first, second) => {
  const pinDiff = Number(Boolean(second.data.isPinned)) - Number(Boolean(first.data.isPinned));
  if (pinDiff) return pinDiff;
  const orderDiff = Number(second.data.sortOrder || 0) - Number(first.data.sortOrder || 0);
  if (orderDiff) return orderDiff;
  return itemTime(second) - itemTime(first);
};

const wallItems = computed(() => {
  const photoItems = props.photos.map((photo) => ({ type: 'photo', key: `photo-${photo.id}`, data: photo }));
  if (!props.includeAlbums || !props.albums.length) return withLoadIndex(photoItems);
  const albumItems = props.albums.map((album) => ({ type: 'album', key: `album-${album.id}`, data: album }));
  return withLoadIndex([...photoItems, ...albumItems].sort(compareWallOrder));
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

const shortestColumnIndex = (heights) => {
  let shortest = 0;
  for (let index = 1; index < heights.length; index += 1) {
    if (heights[index] < heights[shortest]) shortest = index;
  }
  return shortest;
};

const distributeByShortestColumn = (items, count) => {
  const nextColumns = Array.from({ length: Math.max(1, count) }, () => []);
  const heights = Array.from({ length: Math.max(1, count) }, () => 0);

  items.forEach((item) => {
    const target = shortestColumnIndex(heights);
    nextColumns[target].push(item);
    heights[target] += estimateHeight(item);
  });

  return { nextColumns, heights };
};

const distributeByReadingOrder = (items, count) => {
  const columnCount = Math.max(1, count);
  const nextColumns = Array.from({ length: columnCount }, () => []);
  const heights = Array.from({ length: columnCount }, () => 0);

  items.forEach((item, index) => {
    const target = index % columnCount;
    nextColumns[target].push(item);
    heights[target] += estimateHeight(item);
  });

  return { nextColumns, heights };
};

const distributePhotos = (items, count) => {
  const { nextColumns, heights } = props.variant === 'wall'
    ? distributeByReadingOrder(items, count)
    : distributeByShortestColumn(items, count);

  if (props.showCreditCard && nextColumns.length) {
    creditColumnIndex.value = shortestColumnIndex(heights);
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

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const imageForItem = (item) => {
  if (!item) return '';
  if (item.type === 'album') return albumCover(item.data);
  const source = props.variant === 'wall'
    ? ['smallUrl', 'mediumUrl', 'thumbnailUrl', 'originalUrl']
    : ['thumbnailUrl', 'smallUrl', 'mediumUrl', 'originalUrl'];
  return photoImageUrl(item.data, source);
};

const preloadImage = (url) => {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  if (preloadCache.has(url)) return preloadCache.get(url);
  const promise = new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 1800);
    image.onload = done;
    image.onerror = done;
    image.decoding = 'async';
    image.src = url;
    if (image.complete) done();
  });
  preloadCache.set(url, promise);
  return promise;
};

const preloadCardImage = (key) => preloadImage(imageForItem(wallItems.value.find((item) => item.key === key)));

const cardVisualTarget = (card) => card?.firstElementChild || card;

const settleRevealCard = (card) => {
  const key = card?.dataset.waterfallKey;
  if (key) removePendingKey(key);
  enterObserver?.unobserve(card);
  card?.classList.remove('waterfall-item-enter-pending');
  const target = cardVisualTarget(card);
  gsap.killTweensOf(target);
  gsap.set(target, { clearProps: 'transform,opacity' });
};

const revealPendingCard = (card) => {
  const key = card.dataset.waterfallKey;
  if (!key || !pendingEnterKeys.value.has(key)) return;
  enterObserver?.unobserve(card);
  const target = cardVisualTarget(card);

  if (reducedMotion() || revealAnimation.value === 'none') {
    settleRevealCard(card);
    return;
  }

  gsap.killTweensOf(target);
  gsap.set(target, {
    y: revealAnimation.value === 'fade' ? 0 : cardEnterDistance.value,
    opacity: revealAnimation.value === 'fade' ? 0 : 0.96,
    force3D: true
  });
  removePendingKey(key);
  card.classList.remove('waterfall-item-enter-pending');
  const duration = revealDurationSeconds();
  gsap.to(
    target,
    {
      y: 0,
      opacity: 1,
      duration,
      ease: revealAnimation.value === 'fade' ? 'power1.out' : 'power3.out',
      overwrite: 'auto',
      clearProps: 'transform,opacity'
    }
  );
};

const revealQueueGap = () => Math.max(190, Math.min(360, animationStagger.value * 3.2 || 220));

const clearRevealQueue = () => {
  revealQueueRunId += 1;
  revealQueueRunning = false;
  revealQueue = [];
  revealQueueKeys.clear();
};

const processRevealQueue = async () => {
  if (revealQueueRunning || !revealQueue.length) return;
  revealQueueRunning = true;
  const runId = revealQueueRunId;

  while (revealQueue.length && runId === revealQueueRunId) {
    const card = revealQueue.shift();
    const key = card?.dataset.waterfallKey;
    if (key) revealQueueKeys.delete(key);
    if (key) await preloadCardImage(key);
    if (runId !== revealQueueRunId) break;
    if (card?.isConnected) revealPendingCard(card);
    await wait(revealQueueGap());
  }

  if (runId === revealQueueRunId) revealQueueRunning = false;
};

const enqueueRevealCard = (card) => {
  const key = card?.dataset.waterfallKey;
  if (!key || !pendingEnterKeys.value.has(key) || revealQueueKeys.has(key)) return;
  enterObserver?.unobserve(card);
  revealQueueKeys.add(key);
  preloadCardImage(key);
  revealQueue.push(card);
  revealQueue.sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top);
  processRevealQueue();
};

const observePendingEnterCards = async (keys) => {
  await nextTick();
  if (!keys.length || reducedMotion()) {
    pendingEnterKeys.value = new Set();
    clearRevealQueue();
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
          window.setTimeout(() => revealPendingCard(entry.target), revealEntryDelay(index));
        });
    },
    {
      root: null,
      rootMargin: '0px 0px -5% 0px',
      threshold: 0.01
    }
  );

  keys.forEach((key) => {
    if (!pendingEnterKeys.value.has(key)) return;
    const card = wallRef.value?.querySelector(`[data-waterfall-key="${CSS.escape(key)}"]`);
    if (card) enterObserver.observe(card);
  });
};

const observeCurrentPendingCards = async ({ settleVisible = false } = {}) => {
  if (!scrollRevealEnabled.value) return;
  await nextTick();
  const keys = [...pendingEnterKeys.value];
  if (!keys.length) return;
  if (settleVisible) settleInitiallyVisibleCards(keys);
  const remainingKeys = [...pendingEnterKeys.value];
  if (remainingKeys.length) await observePendingEnterCards(remainingKeys);
};

const settleInitiallyVisibleCards = (keys) => {
  if (!keys.length || typeof window === 'undefined') return;
  const viewportBottom = window.innerHeight || 0;
  keys.forEach((key) => {
    const card = wallRef.value?.querySelector(`[data-waterfall-key="${CSS.escape(key)}"]`);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const alreadyInView = rect.top < viewportBottom && rect.bottom > 0;
    if (!alreadyInView) return;
    settleRevealCard(card);
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
  const runId = ++itemsChangeRunId;
  const keys = keysFromSignature(signature);
  const previousKeyList = keysFromSignature(previousSignature);
  const previousKeys = new Set(previousKeyList);
  const previousPhotoKeys = photoKeysFrom(previousKeyList);
  const nextPhotoKeys = photoKeysFrom(keys);
  const isPhotoAppend =
    previousPhotoKeys.length > 0 &&
    nextPhotoKeys.length > previousPhotoKeys.length &&
    previousPhotoKeys.every((key) => keys.includes(key));
  const isInitialBatch = !previousKeyList.length;
  const addedKeys = scrollRevealEnabled.value
    ? (isPhotoAppend
      ? keys.filter((key) => !previousKeys.has(key))
      : (isInitialBatch && shouldAnimateInitial.value ? keys : []))
    : [];
  clearRevealQueue();
  pendingEnterKeys.value = addedKeys.length ? new Set(addedKeys) : new Set();
  await applyColumns({ animateLayout: false });
  if (runId !== itemsChangeRunId) return;
  if (isInitialBatch && addedKeys.length) settleInitiallyVisibleCards(addedKeys);
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
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || wallRef.value?.clientWidth || 0;
      if (Math.abs(width - observedWallWidth) < 2) return;
      observedWallWidth = width;
      requestColumnUpdate(true);
    });
    observedWallWidth = wallRef.value.clientWidth || 0;
    resizeObserver.observe(wallRef.value);
  } else if (!resizeListening) {
    window.addEventListener('resize', onWindowResize);
    resizeListening = true;
  }
  await updateColumns(false);
  await observeCurrentPendingCards({ settleVisible: true });
};

watch(() => wallItems.value.map((item) => item.key).join('|'), handleItemsChange, { immediate: true, flush: 'post' });
watch(wallRef, observeWall, { flush: 'post' });
watch(
  () => props.loading,
  async (loading) => {
    requestColumnUpdate(false);
    if (!loading) {
      await nextTick();
      await observeCurrentPendingCards({ settleVisible: true });
    }
  },
  { flush: 'post' }
);
watch(() => props.variant, () => requestColumnUpdate(false), { flush: 'post' });
watch(() => settings.settings.waterfallColumns, () => requestColumnUpdate(true));
watch(() => settings.settings.waterfallFullBleed, () => requestColumnUpdate(true));

onMounted(() => {
  observeWall();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  enterObserver?.disconnect();
  if (resizeTimer) window.clearTimeout(resizeTimer);
  if (resizeListening) window.removeEventListener('resize', onWindowResize);
  clearRevealQueue();
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
  will-change: auto;
}

.waterfall-item-enter-pending > :is(.photo-card, .wall-album-card) {
  opacity: var(--waterfall-reveal-opacity, 0.96);
  transform: translate3d(0, var(--waterfall-reveal-y, var(--waterfall-card-enter-y)), 0);
  will-change: transform, opacity;
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
    transform: none;
  }
}
</style>
