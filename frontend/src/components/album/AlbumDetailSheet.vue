<template>
  <teleport to="body">
    <transition name="album-mask">
      <div v-if="visible" class="album-mask" @click.self="close" />
    </transition>
    <transition name="album-sheet">
      <section v-if="visible" class="album-sheet" role="dialog" aria-modal="true" :aria-label="album?.title || initialAlbum?.title || '相册详情'">
        <header class="sheet-header">
          <div class="grab" />
          <div>
            <p class="eyebrow">ALBUM</p>
            <h2>{{ album?.title || initialAlbum?.title || '相册详情' }}</h2>
          </div>
          <span class="count">{{ album?.photos?.length || initialAlbum?.photoCount || 0 }} 张照片</span>
          <button class="close-button" type="button" aria-label="关闭相册详情" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <LoadingState v-if="loading" class="loading" />
        <div v-else-if="album" class="sheet-scroll">
          <div class="album-intro">
            <p>{{ album.description || '这个相册还没有描述。' }}</p>
            <span>{{ album.user?.nickname || album.user?.username }}</span>
          </div>

          <div v-if="album.photos?.length" class="album-photos">
            <figure v-for="photo in album.photos" :key="photo.id">
              <img :src="imageUrl(photo.mediumUrl || photo.originalUrl || photo.thumbnailUrl)" :alt="photo.title" loading="lazy" />
              <figcaption>
                <strong>{{ photo.title }}</strong>
                <span>{{ formatDate(photo.takenAt || photo.uploadedAt) }}<template v-if="photo.city || photo.locationName"> · {{ photo.city || photo.locationName }}</template></span>
              </figcaption>
            </figure>
          </div>
          <EmptyState v-else title="相册暂无照片" description="相册加入照片后会显示在这里。" />
        </div>
      </section>
    </transition>
  </teleport>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { Close } from '@element-plus/icons-vue';
import { albumApi } from '../../api/album.api.js';
import { imageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';
import { setPageScrollLocked, unlockPageScroll } from '../../utils/scrollLock.js';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  albumId: { type: Number, default: null },
  initialAlbum: { type: Object, default: null }
});

const emit = defineEmits(['close']);
const album = ref(null);
const loading = ref(false);
let requestVersion = 0;
const scrollLockKey = Symbol('album-detail-sheet');

const close = () => emit('close');

const load = async () => {
  if (!props.visible || !props.albumId) return;
  const version = ++requestVersion;
  album.value = props.initialAlbum ? { ...props.initialAlbum } : null;
  loading.value = !album.value?.photos?.length;
  try {
    const result = await albumApi.detail(props.albumId);
    if (version === requestVersion) album.value = result.data;
  } finally {
    if (version === requestVersion) loading.value = false;
  }
};

const onKey = (event) => {
  if (props.visible && event.key === 'Escape') close();
};

watch(() => [props.visible, props.albumId], load, { immediate: true });
watch(() => props.visible, (visible) => {
  setPageScrollLocked(scrollLockKey, visible);
}, { immediate: true });
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  unlockPageScroll(scrollLockKey);
});
</script>

<style scoped>
.album-mask {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: var(--theme-overlay-bg);
  backdrop-filter: blur(3px);
}

.album-sheet {
  position: fixed;
  z-index: 1051;
  right: 0;
  bottom: 0;
  left: 0;
  height: 90dvh;
  overflow: hidden;
  border-top: 1px solid var(--theme-line);
  border-radius: 10px 10px 0 0;
  color: var(--theme-text);
  background: var(--theme-surface-overlay);
  box-shadow: var(--theme-shadow);
}

.sheet-header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 88px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px clamp(18px, 4vw, 44px);
  border-bottom: 1px solid var(--theme-line);
  background: color-mix(in srgb, var(--theme-surface-overlay) 94%, transparent);
  backdrop-filter: blur(18px);
}

.grab {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 42px;
  height: 4px;
  border-radius: 99px;
  background: var(--theme-line);
  transform: translateX(-50%);
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 900;
}

h2 {
  margin: 0;
  font-size: clamp(22px, 3vw, 31px);
}

.count {
  margin-left: auto;
  color: var(--theme-muted-strong);
  font-size: 13px;
}

.close-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-line);
  border-radius: 50%;
  color: var(--theme-text);
  background: var(--theme-button-bg);
  cursor: pointer;
}

.loading {
  margin-top: 42px;
}

.sheet-scroll {
  height: calc(90dvh - 88px);
  padding: clamp(20px, 3vw, 36px) clamp(16px, 4vw, 44px) 52px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.album-intro,
.album-photos {
  width: min(100%, 900px);
  margin: 0 auto;
}

.album-intro {
  margin-bottom: clamp(26px, 4vw, 42px);
}

.album-intro p {
  max-width: 720px;
  margin: 0 0 13px;
  color: var(--theme-text-soft);
  font-size: 15px;
  line-height: 1.85;
}

.album-intro span {
  color: var(--theme-muted-strong);
  font-size: 13px;
}

.album-photos {
  display: grid;
  gap: clamp(28px, 5vw, 54px);
}

figure {
  margin: 0;
}

figure img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 78dvh;
  margin: 0 auto;
  border-radius: 4px;
}

figcaption {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 10px;
  color: var(--theme-muted-strong);
  font-size: 13px;
}

figcaption strong {
  color: var(--theme-text);
}

.album-sheet-enter-active,
.album-sheet-leave-active {
  transition: transform 0.42s cubic-bezier(0.22, 0.8, 0.2, 1);
}

.album-sheet-enter-from,
.album-sheet-leave-to {
  transform: translateY(100%);
}

.album-mask-enter-active,
.album-mask-leave-active {
  transition: opacity 0.32s ease;
}

.album-mask-enter-from,
.album-mask-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .sheet-header {
    min-height: 78px;
    gap: 12px;
    padding: 18px 14px 12px;
  }

  .count {
    display: none;
  }

  .sheet-scroll {
    height: calc(90dvh - 78px);
    padding: 18px 12px 36px;
  }

  figcaption {
    flex-direction: column;
    gap: 3px;
  }
}
</style>
