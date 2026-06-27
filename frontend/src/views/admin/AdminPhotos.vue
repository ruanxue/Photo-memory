<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">照片管理</h1>
        <p class="section-subtitle">审核、编辑、删除、精选和批量修改照片。</p>
      </div>
    </div>
    <div class="toolbar surface">
      <el-input v-model="q" clearable placeholder="搜索照片" @keyup.enter="load" />
      <el-select v-model="batch.action" clearable placeholder="批量操作">
        <el-option label="删除" value="delete" />
        <el-option label="设为公开" value="visibility-public" />
        <el-option label="设为私密" value="visibility-private" />
        <el-option label="设为精选" value="feature" />
        <el-option label="取消精选" value="unfeature" />
        <el-option label="打标签" value="tags" />
      </el-select>
      <TagSelect v-if="batch.action === 'tags'" v-model="batch.tags" placeholder="选择标签" />
      <el-button @click="runBatch">执行</el-button>
      <el-button type="primary" @click="load">搜索</el-button>
    </div>
    <el-table :data="photos" class="surface admin-photo-table" scrollbar-always-on table-layout="auto" @selection-change="selection = $event">
      <el-table-column type="selection" width="46" />
      <el-table-column label="图" width="104">
        <template #default="{ row }">
          <button class="thumb-button" type="button" :aria-label="`查看 ${row.title}`" @click="openDetail(row)">
            <img class="table-thumb" :src="row.thumbnailUrl" :alt="row.title" />
          </button>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="210" />
      <el-table-column label="作者" min-width="150"><template #default="{ row }">{{ row.user?.nickname || row.user?.username }}</template></el-table-column>
      <el-table-column label="可见性" min-width="126">
        <template #default="{ row }">
          <VisibilityToggleButton
            :value="row.visibility"
            :loading="visibilityBusyId === row.id"
            @toggle="toggleVisibility(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column label="来源" min-width="96">
        <template #default="{ row }">
          <span class="source-badge" :class="{ external: isExternalPhoto(row) }">{{ isExternalPhoto(row) ? '外链' : '本地' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" min-width="190">
        <template #default="{ row }">
          <div class="status-buttons">
            <el-button
              size="small"
              :type="row.isFeatured ? 'primary' : 'default'"
              :plain="!row.isFeatured"
              :loading="statusBusyId === `feature-${row.id}`"
              @click="feature(row)"
            >
              精选
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="160">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @update:page="load" @update:page-size="reload" />

    <el-dialog v-model="dialogVisible" title="编辑照片" width="680px" class="photo-edit-dialog" :lock-scroll="false">
      <el-form :model="form" label-position="top">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-collapse v-if="isExternalPhoto(form)" v-model="urlCollapse" class="edit-collapse">
          <el-collapse-item name="url">
            <template #title>
              <span class="collapse-title">图片 URL</span>
              <span class="collapse-subtitle">{{ form.originalUrl || '未填写外链地址' }}</span>
            </template>
            <div class="external-url-fields">
              <el-form-item label="图片 URL"><el-input v-model="form.originalUrl" /></el-form-item>
              <el-form-item label="中图 URL"><el-input v-model="form.mediumUrl" /></el-form-item>
              <el-form-item label="缩略图 URL"><el-input v-model="form.thumbnailUrl" /></el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
        <div class="edit-grid">
          <el-form-item label="相册"><el-select v-model="form.albumId" clearable><el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" /></el-select></el-form-item>
          <el-form-item label="可见性"><el-select v-model="form.visibility"><el-option label="公开" value="public" /><el-option label="私密" value="private" /></el-select></el-form-item>
          <el-form-item class="location-editor-item" label="拍摄地点">
            <PhotoLocationEditor
              :key="`location-${currentId || 'new'}`"
              v-model="locationModel"
              collapsible
              :initial-open="false"
            />
          </el-form-item>
        </div>
        <el-collapse v-model="exifCollapse" class="edit-collapse exif-edit-collapse">
          <el-collapse-item name="exif">
            <template #title>
              <span class="collapse-title">EXIF 信息</span>
              <span class="collapse-subtitle">{{ exifSummary }}</span>
            </template>
            <div class="edit-grid exif-edit-grid">
              <el-form-item label="相机品牌"><el-input v-model="form.cameraMake" /></el-form-item>
              <el-form-item label="相机型号"><el-input v-model="form.cameraModel" /></el-form-item>
              <el-form-item label="镜头"><el-input v-model="form.lensModel" /></el-form-item>
              <el-form-item label="焦距 mm"><el-input v-model="form.focalLength" /></el-form-item>
              <el-form-item label="光圈"><el-input v-model="form.aperture" /></el-form-item>
              <el-form-item label="快门"><el-input v-model="form.shutterSpeed" /></el-form-item>
              <el-form-item label="ISO"><el-input-number v-model="form.iso" :min="0" /></el-form-item>
              <el-form-item label="曝光补偿"><el-input v-model="form.exposureCompensation" /></el-form-item>
              <el-form-item label="白平衡"><el-input v-model="form.whiteBalance" /></el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
        <el-form-item label="标签"><TagSelect v-model="form.tags" placeholder="选择标签" /></el-form-item>
        <el-checkbox v-model="form.isFeatured">精选</el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import { albumApi } from '../../api/album.api.js';
import Pagination from '../../components/common/Pagination.vue';
import VisibilityToggleButton from '../../components/common/VisibilityToggleButton.vue';
import TagSelect from '../../components/common/TagSelect.vue';
import PhotoLocationEditor from '../../components/map/PhotoLocationEditor.vue';
import { isExternalPhoto } from '../../utils/image.js';

const router = useRouter();
const photos = ref([]);
const albums = ref([]);
const selection = ref([]);
const q = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const currentId = ref(null);
const dialogVisible = ref(false);
const urlCollapse = ref([]);
const exifCollapse = ref([]);
const batch = reactive({ action: '', tags: [] });
const form = reactive({});
const visibilityBusyId = ref(null);
const statusBusyId = ref('');
const listStateKey = 'photo-memory.admin-photos.state';

const locationModel = computed({
  get: () => ({
    country: form.country || '',
    city: form.city || '',
    locationName: form.locationName || '',
    latitude: form.latitude ?? '',
    longitude: form.longitude ?? ''
  }),
  set: (value) => {
    form.country = value.country || '';
    form.city = value.city || '';
    form.locationName = value.locationName || '';
    form.latitude = value.latitude || '';
    form.longitude = value.longitude || '';
  }
});

const exifSummary = computed(() => {
  const aperture = String(form.aperture || '').trim();
  const parts = [
    form.cameraMake,
    form.cameraModel,
    form.lensModel,
    form.focalLength ? `${form.focalLength}mm` : '',
    aperture ? (aperture.toLowerCase().startsWith('f/') ? aperture : `f/${aperture}`) : '',
    form.iso ? `ISO ${form.iso}` : ''
  ].filter(Boolean);
  return parts.length ? parts.slice(0, 4).join(' · ') : '暂无 EXIF 信息';
});

const load = async () => {
  const res = await adminApi.photos({ q: q.value, page: page.value, pageSize: pageSize.value });
  photos.value = res.data;
  total.value = res.meta?.total || 0;
};
const reload = () => { page.value = 1; load(); };
const saveListState = () => {
  sessionStorage.setItem(listStateKey, JSON.stringify({
    q: q.value,
    page: page.value,
    pageSize: pageSize.value,
    scrollY: window.scrollY
  }));
};
const restoreListState = () => {
  try {
    const raw = sessionStorage.getItem(listStateKey);
    if (!raw) return null;
    sessionStorage.removeItem(listStateKey);
    const state = JSON.parse(raw);
    q.value = typeof state.q === 'string' ? state.q : '';
    page.value = Number(state.page) > 0 ? Number(state.page) : 1;
    pageSize.value = Number(state.pageSize) > 0 ? Number(state.pageSize) : 20;
    return Number.isFinite(Number(state.scrollY)) ? Number(state.scrollY) : null;
  } catch {
    return null;
  }
};
const openDetail = (row) => {
  saveListState();
  router.push(`/photos/${row.id}`);
};
const openEdit = (row) => {
  currentId.value = row.id;
  urlCollapse.value = [];
  exifCollapse.value = [];
  Object.keys(form).forEach((key) => delete form[key]);
  Object.assign(form, {
    title: row.title || '',
    description: row.description || '',
    originalUrl: row.originalUrl || '',
    mediumUrl: row.mediumUrl || '',
    thumbnailUrl: row.thumbnailUrl || '',
    mimeType: row.mimeType || '',
    fileSize: row.fileSize ?? null,
    albumId: row.albumId || null,
    visibility: row.visibility || 'public',
    country: row.country || '',
    city: row.city || '',
    locationName: row.locationName || '',
    latitude: row.latitude ?? '',
    longitude: row.longitude ?? '',
    cameraMake: row.cameraMake || '',
    cameraModel: row.cameraModel || '',
    lensModel: row.lensModel || '',
    focalLength: row.focalLength ?? '',
    aperture: row.aperture ?? '',
    shutterSpeed: row.shutterSpeed || '',
    iso: row.iso ?? null,
    exposureCompensation: row.exposureCompensation || '',
    whiteBalance: row.whiteBalance || '',
    tags: row.tags?.map((item) => item.tag.name) || [],
    isFeatured: Boolean(row.isFeatured)
  });
  dialogVisible.value = true;
};
const save = async () => {
  const payload = { ...form };
  if (!isExternalPhoto(form)) {
    delete payload.originalUrl;
    delete payload.mediumUrl;
    delete payload.thumbnailUrl;
  } else {
    payload.mediumUrl = payload.mediumUrl || payload.originalUrl;
    payload.thumbnailUrl = payload.thumbnailUrl || payload.mediumUrl || payload.originalUrl;
  }
  delete payload.sortOrder;
  delete payload.showInWaterfall;
  delete payload.isPinned;
  await adminApi.updatePhoto(currentId.value, payload);
  ElMessage.success('已保存');
  dialogVisible.value = false;
  load();
};
const toggleVisibility = async (row, visibility) => {
  visibilityBusyId.value = row.id;
  try {
    await adminApi.visibilityPhoto(row.id, { visibility });
    row.visibility = visibility;
    ElMessage.success('可见性已更新');
  } finally {
    visibilityBusyId.value = null;
  }
};
const feature = async (row) => {
  statusBusyId.value = `feature-${row.id}`;
  try {
    const next = !row.isFeatured;
    await adminApi.featurePhoto(row.id, { isFeatured: next });
    row.isFeatured = next;
  } finally {
    statusBusyId.value = '';
  }
};
const remove = async (row) => { await ElMessageBox.confirm(`确定删除「${row.title}」吗？`, '删除照片', { type: 'warning' }); await adminApi.deletePhoto(row.id); load(); };
const runBatch = async () => {
  if (!selection.value.length) return ElMessage.warning('请选择照片');
  const ids = selection.value.map((item) => item.id);
  if (batch.action === 'delete') await adminApi.batchPhotos({ ids, action: 'delete' });
  if (batch.action === 'visibility-public') await adminApi.batchPhotos({ ids, action: 'visibility', visibility: 'public' });
  if (batch.action === 'visibility-private') await adminApi.batchPhotos({ ids, action: 'visibility', visibility: 'private' });
  if (batch.action === 'feature') await adminApi.batchPhotos({ ids, action: 'feature', isFeatured: true });
  if (batch.action === 'unfeature') await adminApi.batchPhotos({ ids, action: 'feature', isFeatured: false });
  if (batch.action === 'tags') await adminApi.batchPhotos({ ids, action: 'tags', tags: batch.tags });
  ElMessage.success('批量操作完成');
  load();
};
onMounted(async () => {
  const restoreY = restoreListState();
  const albumRes = await albumApi.list({ pageSize: 100 });
  albums.value = albumRes.data;
  await load();
  await nextTick();
  if (restoreY !== null) requestAnimationFrame(() => window.scrollTo({ top: restoreY, behavior: 'auto' }));
});
</script>

<style scoped>
.toolbar { padding: 14px; }
.toolbar .el-input, .toolbar .el-select { width: 190px; }
.edit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.location-editor-item {
  grid-column: 1 / -1;
}

.edit-collapse {
  margin: 12px 0;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  background: var(--theme-surface-soft);
  overflow: hidden;
}
.edit-collapse :deep(.el-collapse-item__header) {
  min-height: 46px;
  padding: 0 12px;
  border-bottom: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius)) !important;
  color: var(--theme-text);
  background: transparent;
}

.edit-collapse :deep(.el-collapse-item__header.is-active) {
  border-radius: var(--theme-card-radius, var(--radius)) var(--theme-card-radius, var(--radius)) 0 0 !important;
}

.edit-collapse :deep(.el-collapse-item__content) {
  padding: 12px;
  color: var(--theme-text);
  background: transparent;
}
.edit-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
  border-radius: 0 0 var(--theme-card-radius, var(--radius)) var(--theme-card-radius, var(--radius)) !important;
  background: transparent;
  overflow: hidden;
}
.collapse-title {
  flex: 0 0 auto;
  font-weight: 700;
  color: var(--theme-text);
}
.collapse-subtitle {
  min-width: 0;
  margin-left: 10px;
  overflow: hidden;
  color: var(--theme-muted-strong);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.external-url-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.exif-edit-grid {
  margin-top: 0;
}
.admin-photo-table {
  width: 100%;
}
.admin-photo-table :deep(.cell) {
  white-space: nowrap;
}
.thumb-button {
  display: block;
  width: 68px;
  height: 52px;
  padding: 0;
  border: 0;
  border-radius: calc(var(--theme-card-radius, var(--radius)) * 0.75);
  background: transparent;
  cursor: pointer;
  overflow: hidden;
}

.thumb-button .table-thumb {
  display: block;
  width: 100%;
  height: 100%;
}

.status-buttons {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.status-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

.status-buttons :deep(.el-button),
.action-buttons :deep(.el-button),
.toolbar :deep(.el-button) {
  min-height: 32px;
  padding-inline: 12px;
  border-radius: var(--theme-control-radius, var(--radius));
  font-weight: 700;
}

.action-buttons {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.action-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}
.source-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid var(--theme-line);
  border-radius: 999px;
  color: var(--theme-muted-strong);
  background: var(--theme-button-bg);
  font-size: 12px;
  font-weight: 800;
}
.source-badge.external {
  color: var(--theme-tag-text);
  border-color: var(--theme-tag-border);
  background: var(--theme-tag-bg);
}
</style>
