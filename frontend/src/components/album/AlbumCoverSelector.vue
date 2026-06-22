<template>
  <div class="album-photo-manager">
    <div class="manager-head">
      <div>
        <strong>相册内照片</strong>
        <span>拖动或使用上下移调整浏览顺序；排序第一张会作为相册卡片头图，也可控制照片是否单独出现在首页瀑布流。</span>
      </div>
    </div>

    <div v-if="orderedPhotos.length" class="photo-sort-list">
      <article
        v-for="(photo, index) in orderedPhotos"
        :key="photo.id"
        class="photo-sort-item"
        :class="{ dragging: draggingId === Number(photo.id) }"
        draggable="true"
        @dragstart="startDrag(photo.id)"
        @dragover.prevent="dragOver(photo.id)"
        @drop.prevent="endDrag"
        @dragend="endDrag"
      >
        <div class="photo-rank">{{ index + 1 }}</div>
        <div class="photo-cover">
          <img :src="imageUrl(photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl)" :alt="photo.title" draggable="false" />
        </div>

        <div class="photo-sort-body">
          <strong>{{ photo.title || '未命名照片' }}</strong>
          <small>{{ photoMeta(photo) }}</small>
        </div>

        <div class="card-actions">
          <button
            type="button"
            class="state-button"
            :class="{ active: standaloneState(photo) }"
            :disabled="!canStandalone(photo) && !standaloneState(photo)"
            @click="toggleStandalone(photo)"
          >
            {{ standaloneState(photo) ? '单独展示' : '归档隐藏' }}
          </button>
          <button
            type="button"
            class="state-button"
            :class="{ active: visibilityState(photo) === 'public' }"
            :disabled="!canChangeVisibility(photo)"
            @click="toggleVisibility(photo)"
          >
            {{ visibilityState(photo) === 'public' ? '公开' : '私密' }}
          </button>
          <button type="button" :disabled="index === 0" @click="move(photo.id, -1)">上移</button>
          <button type="button" :disabled="index === orderedPhotos.length - 1" @click="move(photo.id, 1)">下移</button>
        </div>
      </article>
    </div>

    <p v-else class="empty-note">这个相册还没有照片，保存后可在相册内照片中调整顺序。</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { imageUrl } from '../../utils/image.js';

const props = defineProps({
  photos: { type: Array, default: () => [] },
  order: { type: Array, default: () => [] },
  standalone: { type: Object, default: () => ({}) },
  visibility: { type: Object, default: () => ({}) },
  albumVisibility: { type: String, default: 'public' }
});

const emit = defineEmits(['update:order', 'update:standalone', 'update:visibility']);

const draggingId = ref(null);

const orderedPhotos = computed(() => {
  const byId = new Map(props.photos.map((photo) => [Number(photo.id), photo]));
  const used = new Set();
  const result = [];

  props.order.map(Number).forEach((id) => {
    const photo = byId.get(id);
    if (!photo || used.has(id)) return;
    result.push(photo);
    used.add(id);
  });

  props.photos.forEach((photo) => {
    const id = Number(photo.id);
    if (!used.has(id)) result.push(photo);
  });

  return result;
});

const currentOrder = () => orderedPhotos.value.map((photo) => Number(photo.id));

const emitOrder = (ids) => {
  emit('update:order', ids);
};

const photoMeta = (photo) => [photo.city, photo.locationName].filter(Boolean).join(' · ') || '未填写地点';

const visibilityState = (photo) => {
  const id = Number(photo.id);
  if (Object.prototype.hasOwnProperty.call(props.visibility, id)) return props.visibility[id] === 'private' ? 'private' : 'public';
  return photo.visibility === 'private' ? 'private' : 'public';
};

const canChangeVisibility = (photo) => photo.status !== 'deleted';

const canStandalone = (photo) => props.albumVisibility === 'public' && visibilityState(photo) === 'public' && photo.status !== 'deleted';

const standaloneState = (photo) => {
  const id = Number(photo.id);
  if (Object.prototype.hasOwnProperty.call(props.standalone, id)) return Boolean(props.standalone[id]);
  return Boolean(photo.showInWaterfall);
};

const setStandalone = (photo, value) => {
  if (!canStandalone(photo) && value) return;
  emit('update:standalone', { ...props.standalone, [Number(photo.id)]: Boolean(value) });
};

const toggleStandalone = (photo) => {
  setStandalone(photo, !standaloneState(photo));
};

const toggleVisibility = (photo) => {
  if (!canChangeVisibility(photo)) return;
  const id = Number(photo.id);
  const next = visibilityState(photo) === 'public' ? 'private' : 'public';
  emit('update:visibility', { ...props.visibility, [id]: next });
  if (next === 'private' && standaloneState(photo)) {
    emit('update:standalone', { ...props.standalone, [id]: false });
  }
};

const move = (photoId, offset) => {
  const ids = currentOrder();
  const from = ids.indexOf(Number(photoId));
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  emitOrder(ids);
};

const startDrag = (photoId) => {
  draggingId.value = Number(photoId);
};

const dragOver = (targetPhotoId) => {
  if (!draggingId.value || draggingId.value === Number(targetPhotoId)) return;
  const ids = currentOrder();
  const from = ids.indexOf(draggingId.value);
  const to = ids.indexOf(Number(targetPhotoId));
  if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  emitOrder(ids);
};

const endDrag = () => {
  draggingId.value = null;
};

watch(
  () => props.photos.map((photo) => photo.id).join(','),
  () => {
    if (!props.photos.length) emitOrder([]);
    else if (!props.order.length) emitOrder(props.photos.map((photo) => Number(photo.id)));
  },
  { immediate: true }
);
</script>

<style scoped>
.album-photo-manager {
  display: grid;
  gap: 12px;
  width: 100%;
}

.manager-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  color: var(--theme-text);
  background: var(--theme-surface-soft);
}

.manager-head > div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.manager-head strong {
  font-weight: 900;
}

.manager-head span {
  color: var(--theme-muted-strong);
  font-size: 13px;
  line-height: 1.5;
}

.photo-sort-list {
  max-height: 470px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 10px;
  padding: 2px;
}

.photo-sort-item {
  display: grid;
  grid-template-columns: 34px 72px minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  color: var(--theme-text);
  background: var(--theme-surface-soft);
  transition: opacity 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.photo-sort-item:hover {
  border-color: var(--theme-button-hover-border);
  background: color-mix(in srgb, var(--theme-surface-soft) 88%, var(--theme-primary) 12%);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--theme-text) 8%, transparent);
}

.photo-sort-item.dragging {
  opacity: 0.56;
  transform: scale(0.985);
}

.photo-rank {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-line);
  border-radius: 999px;
  color: var(--theme-muted-strong);
  background: var(--theme-surface);
  font-size: 12px;
  font-weight: 900;
}

.photo-cover {
  position: relative;
  display: block;
  width: 72px;
  height: 54px;
  padding: 0;
  border: 0;
  border-radius: calc(var(--theme-card-radius, var(--radius)) * 0.75);
  color: inherit;
  background: transparent;
  overflow: hidden;
}

.photo-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.photo-sort-body {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.photo-sort-body strong {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-sort-body small {
  color: var(--theme-muted-strong);
}

.card-actions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--theme-line-soft);
}

.card-actions button {
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid var(--theme-button-border);
  border-radius: var(--theme-control-radius, var(--radius));
  color: var(--theme-button-text);
  background: var(--theme-button-bg);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.card-actions button.active,
.card-actions button:hover:not(:disabled) {
  color: var(--theme-button-primary-text);
  border-color: var(--theme-button-primary-bg);
  background: var(--theme-button-primary-bg);
}

.card-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.empty-note {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  color: var(--theme-muted-strong);
  background: var(--theme-surface-soft);
}

@media (max-width: 640px) {
  .manager-head {
    align-items: stretch;
    flex-direction: column;
  }

  .photo-sort-list {
    grid-template-columns: 1fr;
  }

  .card-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
