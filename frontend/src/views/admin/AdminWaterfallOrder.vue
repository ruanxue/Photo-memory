<template>
  <section class="admin-page waterfall-order-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">瀑布流排序</h1>
        <p class="section-subtitle">只管理首页瀑布流中可能出现的公开相册和照片卡片。</p>
      </div>
      <div class="head-actions">
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :loading="saving" @click="saveOrder">保存排序</el-button>
      </div>
    </div>

    <div class="toolbar surface order-toolbar">
      <el-input v-model="keyword" clearable placeholder="搜索标题、城市或相册" />
      <el-select v-model="typeFilter" placeholder="类型">
        <el-option label="全部" value="all" />
        <el-option label="相册" value="album" />
        <el-option label="照片" value="photo" />
      </el-select>
    </div>

    <div class="order-info surface">
      <strong>排序规则</strong>
      <span>置顶项永远排在最前面，普通项不能越过置顶区；列表从上到下就是首页瀑布流的先后顺序。</span>
    </div>

    <div v-loading="loading" class="order-list">
      <article
        v-for="(item, index) in visibleTopItems"
        :key="item.key"
        class="order-entry"
      >
        <div
          class="order-card surface"
          :class="{ dragging: draggingKey === item.key }"
          draggable="true"
          @dragstart="startDrag(item.key)"
          @dragover.prevent="dragOver(item.key)"
          @drop.prevent="endDrag"
          @dragend="endDrag"
        >
          <div class="order-rank">{{ index + 1 }}</div>
          <img class="order-thumb" :src="item.thumb" :alt="item.title" draggable="false" />

          <div class="order-body">
            <div class="order-title-line">
              <el-tag effect="plain">{{ item.type === 'album' ? '相册' : '照片' }}</el-tag>
              <strong>{{ item.title || '未命名' }}</strong>
            </div>
            <p>{{ item.meta }}</p>
            <div class="order-badges">
              <span class="on">公开展示</span>
              <span v-if="item.isPinned" class="on">置顶标记</span>
              <span v-if="item.type === 'photo' && item.albumTitle">单独展示 · {{ item.albumTitle }}</span>
              <span v-if="item.type === 'album'">{{ item.photoCount || 0 }} 张相册照片</span>
            </div>
          </div>

          <div class="order-controls">
            <el-button
              :type="item.isPinned ? 'primary' : 'default'"
              :plain="!item.isPinned"
              @click="togglePin(item)"
            >
              {{ item.isPinned ? '取消置顶' : '置顶' }}
            </el-button>
            <div class="move-buttons">
              <el-button :disabled="!canMoveVisible(index, -1)" @click="moveVisible(index, -1)">上移</el-button>
              <el-button :disabled="!canMoveVisible(index, 1)" @click="moveVisible(index, 1)">下移</el-button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import { albumCover, imageUrl } from '../../utils/image.js';

const topItems = ref([]);
const loading = ref(false);
const saving = ref(false);
const draggingKey = ref('');
const keyword = ref('');
const typeFilter = ref('all');

const loadAllPhotos = async () => {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await adminApi.photos({ page, pageSize: 100, sort: 'custom' });
    all.push(...(res.data || []));
    totalPages = res.meta?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);
  return all;
};

const albumThumb = (album) => albumCover(album);
const photoThumb = (photo) => imageUrl(photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl);
const isPublic = (value) => value === 'public';
const isNotDeleted = (item) => item.status !== 'deleted';

const compareByStoredOrder = (a, b) => {
  if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
  if (Number(b.sortOrder || 0) !== Number(a.sortOrder || 0)) return Number(b.sortOrder || 0) - Number(a.sortOrder || 0);
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
};

const normalizePinnedOrder = (items = topItems.value) => {
  const pinned = [];
  const normal = [];
  items.forEach((item) => {
    if (item.isPinned) pinned.push(item);
    else normal.push(item);
  });
  return [...pinned, ...normal];
};

const makeAlbumItem = (album) => ({
  key: `album-${album.id}`,
  type: 'album',
  id: Number(album.id),
  title: album.title,
  thumb: albumThumb(album),
  visibility: album.visibility || 'public',
  isPinned: Boolean(album.isPinned),
  sortOrder: Number(album.sortOrder) || 0,
  createdAt: album.createdAt,
  photoCount: album.photoCount || 0,
  source: album,
  meta: `${album.photoCount || 0} 张照片`
});

const makePhotoItem = (photo, album) => ({
  key: `photo-${photo.id}`,
  type: 'photo',
  id: Number(photo.id),
  title: photo.title,
  thumb: photoThumb(photo),
  visibility: photo.visibility || 'public',
  status: photo.status || 'normal',
  sortOrder: Number(photo.sortOrder) || 0,
  createdAt: photo.createdAt,
  albumId: photo.albumId || null,
  albumTitle: album?.title || photo.album?.title || '',
  albumVisibility: album?.visibility || photo.album?.visibility || 'public',
  isPinned: Boolean(photo.isPinned),
  showInWaterfall: Boolean(photo.showInWaterfall),
  source: photo,
  meta: [photo.city, photo.locationName].filter(Boolean).join(' · ') || '未填写地点'
});

const canTopPhoto = (photo) => {
  if (!isPublic(photo.visibility) || !isNotDeleted(photo)) return false;
  if (!photo.albumId) return true;
  return photo.showInWaterfall && isPublic(photo.albumVisibility);
};

const buildData = (albums, photos) => {
  const albumMap = new Map(albums.map((album) => [Number(album.id), album]));
  const publicAlbums = albums.filter((album) => isPublic(album.visibility)).map(makeAlbumItem);
  const topPhotos = photos
    .map((photo) => makePhotoItem(photo, photo.albumId ? albumMap.get(Number(photo.albumId)) || photo.album : null))
    .filter(canTopPhoto);

  topItems.value = [...publicAlbums, ...topPhotos].sort(compareByStoredOrder);
};

const load = async () => {
  loading.value = true;
  try {
    const [albumRes, photos] = await Promise.all([adminApi.albums(), loadAllPhotos()]);
    buildData(albumRes.data || [], photos);
  } finally {
    loading.value = false;
  }
};

const visibleTopItems = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return topItems.value.filter((item) => {
    if (typeFilter.value !== 'all' && item.type !== typeFilter.value) return false;
    if (!q) return true;
    return [item.title, item.meta, item.albumTitle].filter(Boolean).some((text) => String(text).toLowerCase().includes(q));
  });
});

const reorderByKeys = (fromKey, toKey) => {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const from = topItems.value.findIndex((item) => item.key === fromKey);
  const to = topItems.value.findIndex((item) => item.key === toKey);
  if (from < 0 || to < 0 || from === to) return;
  if (Boolean(topItems.value[from].isPinned) !== Boolean(topItems.value[to].isPinned)) return;
  const next = [...topItems.value];
  next.splice(to, 0, next.splice(from, 1)[0]);
  topItems.value = normalizePinnedOrder(next);
};

const moveToPinnedTop = (key) => {
  const index = topItems.value.findIndex((item) => item.key === key);
  if (index < 0) return;
  const next = [...topItems.value];
  next.unshift(next.splice(index, 1)[0]);
  topItems.value = normalizePinnedOrder(next);
};

const togglePin = (item) => {
  if (item.isPinned) {
    item.isPinned = false;
    topItems.value = normalizePinnedOrder();
    return;
  }
  item.isPinned = true;
  moveToPinnedTop(item.key);
};

const startDrag = (key) => {
  draggingKey.value = key;
};

const dragOver = (targetKey) => {
  reorderByKeys(draggingKey.value, targetKey);
};

const endDrag = () => {
  draggingKey.value = '';
  topItems.value = normalizePinnedOrder();
};

const canMoveVisible = (index, offset) => {
  const current = visibleTopItems.value[index];
  const target = visibleTopItems.value[index + offset];
  if (!current || !target) return false;
  return Boolean(current.isPinned) === Boolean(target.isPinned);
};

const moveVisible = (index, offset) => {
  if (!canMoveVisible(index, offset)) return;
  const current = visibleTopItems.value[index];
  const target = visibleTopItems.value[index + offset];
  if (!current || !target) return;
  reorderByKeys(current.key, target.key);
};

const updateAlbum = (item, sortOrder) => adminApi.updateAlbum(item.id, {
  title: item.source.title,
  description: item.source.description || '',
  visibility: item.source.visibility,
  isPinned: Boolean(item.isPinned),
  coverPhotoId: item.source.coverPhotoId || null,
  sortOrder
});

const updatePhoto = (item, sortOrder) => adminApi.updatePhoto(item.id, {
  sortOrder,
  isPinned: Boolean(item.isPinned),
  showInWaterfall: Boolean(item.showInWaterfall)
});

const saveOrder = async () => {
  saving.value = true;
  try {
    topItems.value = normalizePinnedOrder();
    const total = topItems.value.length;
    for (const [index, item] of topItems.value.entries()) {
      const sortOrder = total - index;
      if (item.type === 'album') await updateAlbum(item, sortOrder);
      else await updatePhoto(item, sortOrder);
      item.sortOrder = sortOrder;
    }

    ElMessage.success('瀑布流排序已保存');
    await load();
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.waterfall-order-page {
  display: grid;
  gap: 16px;
}

.head-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.order-toolbar {
  padding: 14px;
  border-radius: var(--theme-card-radius, var(--radius));
}

.order-toolbar :deep(.el-input),
.order-toolbar :deep(.el-select) {
  width: 210px;
}

.order-info {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--theme-card-radius, var(--radius));
}

.order-info strong {
  color: var(--theme-text);
}

.order-info span {
  color: var(--theme-muted-strong);
}

.order-list {
  display: grid;
  gap: 10px;
}

.order-card {
  display: grid;
  grid-template-columns: 48px 96px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: var(--theme-card-radius, var(--radius));
  transition: opacity 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.order-card:hover {
  border-color: var(--theme-button-hover-border);
  background: color-mix(in srgb, var(--theme-surface-glass) 86%, var(--theme-primary) 14%);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--theme-text) 7%, transparent);
}

.order-card.dragging {
  opacity: 0.58;
  transform: scale(0.99);
}

.order-rank {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-line);
  border-radius: 999px;
  color: var(--theme-text);
  background: var(--theme-surface-soft);
  font-weight: 900;
}

.order-thumb {
  width: 96px;
  height: 70px;
  border: 1px solid var(--theme-line-soft);
  border-radius: calc(var(--theme-card-radius, var(--radius)) * 0.8);
  object-fit: cover;
  background: var(--theme-surface-soft);
  user-select: none;
}

.order-body {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.order-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-title-line strong {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-body p {
  margin: 0;
  color: var(--theme-muted-strong);
}

.order-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.order-badges span {
  min-height: 22px;
  padding: 2px 8px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 999px;
  color: var(--theme-muted-strong);
  background: var(--theme-surface-soft);
  font-size: 12px;
}

.order-badges span.on {
  color: var(--theme-tag-text);
  border-color: var(--theme-tag-border);
  background: var(--theme-tag-bg);
}

.order-controls {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.move-buttons {
  display: flex;
  gap: 8px;
}

.move-buttons :deep(.el-button),
.head-actions :deep(.el-button),
.order-toolbar :deep(.el-button),
.order-controls :deep(.el-button) {
  min-height: 32px;
  border-radius: var(--theme-control-radius, var(--radius));
  font-weight: 700;
}

@media (max-width: 820px) {
  .order-card {
    grid-template-columns: 40px 78px minmax(0, 1fr);
  }

  .order-thumb {
    width: 78px;
    height: 58px;
  }

  .order-controls {
    grid-column: 1 / -1;
    justify-items: stretch;
  }

  .move-buttons {
    justify-content: flex-end;
  }
}
</style>
