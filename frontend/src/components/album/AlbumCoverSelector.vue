<template>
  <div class="cover-selector">
    <button
      class="cover-option auto-option"
      :class="{ active: !normalizedValue }"
      type="button"
      @click="select(null)"
    >
      <span>自动选择</span>
      <small>默认使用相册内第一张照片</small>
    </button>

    <button
      v-for="photo in photos"
      :key="photo.id"
      class="cover-option photo-option"
      :class="{ active: normalizedValue === Number(photo.id) }"
      type="button"
      @click="select(photo.id)"
    >
      <img :src="imageUrl(photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl)" :alt="photo.title" />
      <span>{{ photo.title || '未命名照片' }}</span>
    </button>

    <p v-if="!photos.length" class="empty-note">这个相册还没有照片，保存后可从相册内照片中选择头图。</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { imageUrl } from '../../utils/image.js';

const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
  photos: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

const normalizedValue = computed(() => {
  const value = Number(props.modelValue);
  return Number.isFinite(value) && value > 0 ? value : null;
});

const select = (photoId) => {
  emit('update:modelValue', photoId ? Number(photoId) : null);
};
</script>

<style scoped>
.cover-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 10px;
  width: 100%;
}

.cover-option {
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  color: var(--theme-text);
  background: var(--theme-surface-soft);
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.cover-option:hover,
.cover-option:focus-visible,
.cover-option.active {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 22%, transparent);
  outline: none;
  transform: translateY(-1px);
}

.auto-option {
  min-height: 96px;
  padding: 14px;
  display: grid;
  align-content: center;
  gap: 6px;
}

.auto-option span,
.photo-option span {
  font-weight: 700;
}

.auto-option small {
  color: var(--theme-muted-strong);
  line-height: 1.5;
}

.photo-option {
  padding: 0;
}

.photo-option img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.photo-option span {
  display: block;
  padding: 8px 10px 10px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-note {
  grid-column: 1 / -1;
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--theme-line);
  border-radius: var(--radius);
  color: var(--theme-muted-strong);
  background: var(--theme-surface-glass);
}
</style>
