<template>
  <teleport to="body">
    <div
      v-if="visible || closing"
      ref="lightboxRef"
      class="lightbox"
      :class="{ 'is-ready': stageReady }"
      tabindex="0"
      @click.self="requestClose"
    >
      <div ref="backdropRef" class="lightbox-backdrop" aria-hidden="true" />
      <button v-if="navigation && photos.length > 1" class="arrow left" type="button" aria-label="上一张" @click.stop="move(-1)">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <figure>
        <div class="image-stage" title="点击空白处返回照片墙" @click.self="requestClose">
          <img
            ref="photoRef"
            class="photo-image"
            :src="displaySrc || previewSrc"
            :alt="current?.title"
            :width="current?.width || undefined"
            :height="current?.height || undefined"
            @click.stop
          />
        </div>
        <figcaption @click.stop>
          <button class="caption-title" type="button" @click="showDetail">{{ current?.title }}</button>
          <span>{{ current?.city || current?.locationName }}</span>
        </figcaption>
      </figure>
      <button v-if="navigation && photos.length > 1" class="arrow right" type="button" aria-label="下一张" @click.stop="move(1)">
        <el-icon><ArrowRight /></el-icon>
      </button>
    </div>
    <PhotoDetailSheet
      :visible="detailVisible"
      :photo-id="detailPhoto?.id || null"
      :initial-photo="detailPhoto"
      @close="detailVisible = false"
      @updated="syncDetail"
    />
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { gsap } from 'gsap';
import { imageUrl } from '../../utils/image.js';
import PhotoDetailSheet from './PhotoDetailSheet.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  photos: { type: Array, default: () => [] },
  index: { type: Number, default: 0 },
  navigation: { type: Boolean, default: true },
  originSelector: { type: String, default: '' },
  closeAnimation: { type: String, default: 'origin' }
});

const emit = defineEmits(['close', 'update:index']);

const current = computed(() => props.photos[props.index]);
const currentId = computed(() => current.value?.id);
const previewSrc = computed(() => imageUrl(current.value?.thumbnailUrl || current.value?.mediumUrl || current.value?.originalUrl));
const fullSrc = computed(() => imageUrl(current.value?.originalUrl || current.value?.mediumUrl || current.value?.thumbnailUrl));
const lightboxRef = ref(null);
const backdropRef = ref(null);
const photoRef = ref(null);
const displaySrc = ref('');
const closing = ref(false);
const stageReady = ref(false);
const detailVisible = ref(false);
const detailPhoto = ref(null);
let transition = null;
let hiddenOrigin = null;
let activeId = null;
let imagePreloader = null;
let animationRun = 0;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const uiElements = () => [...(lightboxRef.value?.querySelectorAll('.arrow, figcaption') || [])];
const nextPaint = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

const waitForImage = (image, timeout = 700) => {
  if (!image || (image.complete && image.naturalWidth > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    window.setTimeout(finish, timeout);
  });
};

const findOrigin = (photo) => {
  if (!photo) return null;
  if (props.originSelector) {
    const selectedOrigin = document.querySelector(props.originSelector);
    const selectedRect = selectedOrigin?.getBoundingClientRect();
    if (selectedRect?.width > 0 && selectedRect?.height > 0 && selectedRect.bottom > 0 && selectedRect.top < window.innerHeight) {
      return selectedOrigin;
    }
  }
  const id = String(photo.id);
  const candidates = [...document.querySelectorAll('.photo-card[data-photo-id] .image-button img')];
  return candidates.find((image) => {
    if (image.closest('.photo-card')?.dataset.photoId !== id) return false;
    const rect = image.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }) || null;
};

const restoreOrigin = () => {
  if (!hiddenOrigin) return;
  gsap.set(hiddenOrigin, { clearProps: 'visibility' });
  hiddenOrigin = null;
};

const concealOrigin = (origin) => {
  restoreOrigin();
};

const clearPhotoTransition = () => {
  if (photoRef.value) gsap.set(photoRef.value, { clearProps: 'transform,opacity,visibility' });
};

const loadFullImage = (id) => {
  const source = fullSrc.value;
  if (!source || source === displaySrc.value) return;
  const preloader = new Image();
  imagePreloader = preloader;
  const swap = () => {
    if (imagePreloader !== preloader || !props.visible || closing.value || activeId !== id) return;
    displaySrc.value = source;
  };
  preloader.addEventListener('load', swap, { once: true });
  preloader.src = source;
  if (preloader.complete && preloader.naturalWidth > 0) swap();
};

const photoPreviewUrl = (photo) => imageUrl(photo?.thumbnailUrl || photo?.mediumUrl || photo?.originalUrl);
const photoFullUrl = (photo) => imageUrl(photo?.originalUrl || photo?.mediumUrl || photo?.thumbnailUrl);

const warmImage = (source) => {
  if (!source) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
};

const preloadNearbyImages = (centerIndex = props.index) => {
  if (!props.navigation || props.photos.length < 2) return;
  [-1, 1].forEach((step) => {
    const nextIndex = (centerIndex + step + props.photos.length) % props.photos.length;
    const photo = props.photos[nextIndex];
    warmImage(photoPreviewUrl(photo));
    warmImage(photoFullUrl(photo));
  });
};

const finishClose = () => {
  restoreOrigin();
  transition = null;
  closing.value = false;
  stageReady.value = false;
  emit('close');
};

const openFromCard = async () => {
  const run = ++animationRun;
  closing.value = false;
  stageReady.value = false;
  activeId = currentId.value;
  imagePreloader = null;
  const origin = findOrigin(current.value);
  displaySrc.value = origin?.currentSrc || origin?.src || previewSrc.value;
  await nextTick();
  if (!lightboxRef.value || !photoRef.value || !backdropRef.value) return;

  transition?.kill();
  restoreOrigin();
  clearPhotoTransition();
  await waitForImage(photoRef.value, props.navigation ? 180 : 700);
  await nextPaint();
  if (run !== animationRun || !props.visible || closing.value) return;

  const targetRect = photoRef.value.getBoundingClientRect();
  const originRect = origin?.getBoundingClientRect();
  const controls = uiElements();

  gsap.set(backdropRef.value, { autoAlpha: 0 });
  gsap.set(controls, { autoAlpha: 0, y: 10 });

  if (reducedMotion() || !originRect || !targetRect.width || !targetRect.height) {
    stageReady.value = true;
    gsap.set(photoRef.value, { autoAlpha: 1 });
    gsap.set(backdropRef.value, { autoAlpha: 1 });
    gsap.set(controls, { autoAlpha: 1, y: 0 });
    loadFullImage(activeId);
    preloadNearbyImages();
    return;
  }

  concealOrigin(origin);
  gsap.set(photoRef.value, {
    autoAlpha: 1,
    x: originRect.left - targetRect.left,
    y: originRect.top - targetRect.top,
    scaleX: originRect.width / targetRect.width,
    scaleY: originRect.height / targetRect.height,
    transformOrigin: 'top left'
  });
  stageReady.value = true;
  await nextPaint();
  if (run !== animationRun || !props.visible || closing.value) return;

  transition = gsap.timeline();
  transition.to(backdropRef.value, { autoAlpha: 1, duration: 0.34, ease: 'power1.out' }, 0);
  transition.to(photoRef.value, {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    duration: 0.52,
    ease: 'power3.inOut',
    clearProps: 'transform'
  }, 0);
  transition.to(controls, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.25);
  loadFullImage(activeId);
  preloadNearbyImages();
};

const move = (step) => {
  if (!props.navigation || !props.photos.length || closing.value) return;
  const next = (props.index + step + props.photos.length) % props.photos.length;
  emit('update:index', next);
};

const closeImmediately = () => {
  animationRun += 1;
  transition?.kill();
  restoreOrigin();
  closing.value = false;
  stageReady.value = false;
  emit('close');
};

const showDetail = () => {
  detailPhoto.value = current.value;
  closeImmediately();
  detailVisible.value = true;
};

const syncDetail = (fresh) => {
  const original = props.photos.find((photo) => photo.id === fresh.id);
  if (original) Object.assign(original, fresh);
  detailPhoto.value = original || fresh;
};

const closeToCorner = () => {
  restoreOrigin();
  const controls = uiElements();
  const targetRect = photoRef.value?.getBoundingClientRect();
  const x = targetRect ? 28 - targetRect.left : -window.innerWidth * 0.28;
  const y = targetRect ? 28 - targetRect.top : -window.innerHeight * 0.28;
  transition = gsap.timeline({ onComplete: finishClose });
  transition.to(controls, { autoAlpha: 0, y: 8, duration: 0.16, ease: 'power1.in' }, 0);
  transition.to(photoRef.value, {
    x,
    y,
    scale: 0.18,
    autoAlpha: 0,
    filter: 'blur(6px)',
    transformOrigin: 'top left',
    duration: 0.58,
    ease: 'power3.inOut'
  }, 0);
  transition.to(backdropRef.value, { autoAlpha: 0, duration: 0.38, ease: 'power1.in' }, 0.1);
};

const requestClose = async () => {
  if (!props.visible || closing.value) return;
  animationRun += 1;
  closing.value = true;
  transition?.kill();
  await nextTick();

  if (!stageReady.value || !photoRef.value || !backdropRef.value || reducedMotion()) {
    finishClose();
    return;
  }

  if (props.closeAnimation === 'corner') {
    closeToCorner();
    return;
  }

  const origin = findOrigin(current.value);
  const targetRect = photoRef.value.getBoundingClientRect();
  const originRect = origin?.getBoundingClientRect();
  const controls = uiElements();

  if (!originRect || !targetRect.width || !targetRect.height) {
    transition = gsap.timeline({ onComplete: finishClose });
    transition.to(controls, { autoAlpha: 0, duration: 0.16 }, 0);
    transition.to(photoRef.value, { autoAlpha: 0, scale: 0.98, duration: 0.24 }, 0);
    transition.to(backdropRef.value, { autoAlpha: 0, duration: 0.26 }, 0.04);
    return;
  }

  concealOrigin(origin);
  transition = gsap.timeline({ onComplete: finishClose });
  transition.to(controls, { autoAlpha: 0, y: 8, duration: 0.16, ease: 'power1.in' }, 0);
  transition.to(photoRef.value, {
    x: originRect.left - targetRect.left,
    y: originRect.top - targetRect.top,
    scaleX: originRect.width / targetRect.width,
    scaleY: originRect.height / targetRect.height,
    transformOrigin: 'top left',
    duration: 0.48,
    ease: 'power3.inOut'
  }, 0);
  transition.to(backdropRef.value, { autoAlpha: 0, duration: 0.35, ease: 'power1.in' }, 0.12);
};

const onKey = (event) => {
  if (!props.visible) return;
  if (event.key === 'Escape') requestClose();
  if (props.navigation && event.key === 'ArrowLeft') move(-1);
  if (props.navigation && event.key === 'ArrowRight') move(1);
};

watch(() => props.visible, (visible) => {
  if (visible) {
    openFromCard();
    return;
  }
  if (!closing.value) {
    animationRun += 1;
    transition?.kill();
    restoreOrigin();
    stageReady.value = false;
  }
}, { flush: 'post', immediate: true });

watch(currentId, async (id) => {
  if (!props.visible || closing.value || id === activeId) return;
  animationRun += 1;
  activeId = id;
  transition?.kill();
  restoreOrigin();
  displaySrc.value = previewSrc.value;
  await nextTick();
  await waitForImage(photoRef.value, 180);
  clearPhotoTransition();
  stageReady.value = true;
  gsap.set(photoRef.value, { autoAlpha: 1 });
  if (backdropRef.value) gsap.set(backdropRef.value, { autoAlpha: 1 });
  gsap.set(uiElements(), { autoAlpha: 1, y: 0 });
  concealOrigin(findOrigin(current.value));
  loadFullImage(id);
  preloadNearbyImages(props.index);
}, { flush: 'post' });

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  animationRun += 1;
  transition?.kill();
  restoreOrigin();
});
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  --horizontal-pad: clamp(62px, 7vw, 112px);
  --vertical-pad: clamp(48px, 8dvh, 76px);
  display: grid;
  place-items: center;
  cursor: zoom-out;
}

.lightbox-backdrop {
  position: absolute;
  inset: 0;
  background: var(--theme-lightbox-bg);
  opacity: 0;
  pointer-events: none;
}

figure {
  position: absolute;
  inset: 0;
  z-index: 1;
  margin: 0;
}

.image-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--vertical-pad) var(--horizontal-pad);
}

.photo-image {
  display: block;
  width: auto;
  height: auto;
  max-width: calc(100vw - var(--horizontal-pad) * 2);
  max-height: calc(100dvh - var(--vertical-pad) * 2);
  margin: auto;
  object-fit: contain;
  box-shadow: var(--theme-lightbox-shadow);
  cursor: default;
  will-change: transform;
}

.lightbox:not(.is-ready) .photo-image,
.lightbox:not(.is-ready) .arrow,
.lightbox:not(.is-ready) figcaption {
  opacity: 0;
}

figcaption {
  position: absolute;
  z-index: 2;
  right: max(var(--horizontal-pad), calc((100vw - 1280px) / 2));
  bottom: clamp(14px, 2.4dvh, 26px);
  left: max(var(--horizontal-pad), calc((100vw - 1280px) / 2));
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--theme-lightbox-muted);
  font-size: 14px;
}

.caption-title {
  padding: 0;
  border: 0;
  color: var(--theme-lightbox-text);
  background: transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.caption-title:hover {
  color: var(--theme-primary);
}

.arrow {
  position: fixed;
  z-index: 2;
  top: 50%;
  width: 48px;
  height: 72px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-lightbox-control-border);
  border-radius: 999px;
  color: var(--theme-lightbox-text);
  background: var(--theme-lightbox-control-bg);
  backdrop-filter: blur(14px);
  cursor: pointer;
  transform: translateY(-50%);
  font-size: 28px;
  transition: transform 0.22s ease, background 0.22s ease, color 0.22s ease;
}

.arrow:hover {
  color: var(--theme-primary-text);
  background: var(--theme-primary);
  transform: translateY(-50%) translateY(-1px);
}

.left {
  left: 24px;
}

.right {
  right: 24px;
}

@media (max-width: 700px) {
  .lightbox {
    --horizontal-pad: 14px;
    --vertical-pad: 64px;
  }

  .photo-image {
    max-width: calc(100vw - var(--horizontal-pad) * 2);
    max-height: calc(100dvh - var(--vertical-pad) * 2);
  }

  .arrow {
    width: 36px;
    height: 54px;
  }

  .left {
    left: 10px;
  }

  .right {
    right: 10px;
  }

  figcaption {
    right: 16px;
    bottom: 14px;
    left: 16px;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }
}
</style>
