<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">我的照片</h1>
        <p class="section-subtitle">编辑信息、设置公开状态、批量打标签或删除。</p>
      </div>
      <router-link to="/user/upload"><el-button type="primary">上传</el-button></router-link>
    </div>

    <div class="toolbar surface">
      <el-input v-model="q" placeholder="搜索我的照片" clearable @keyup.enter="load" />
      <el-select v-model="batchAction" placeholder="批量操作">
        <el-option label="设为公开" value="public" />
        <el-option label="设为私密" value="private" />
        <el-option label="设置标签" value="tags" />
        <el-option label="移动到相册" value="album" />
        <el-option label="删除" value="delete" />
      </el-select>
      <TagSelect v-if="batchAction === 'tags'" v-model="batchTags" placeholder="选择标签" />
      <el-select v-if="batchAction === 'album'" v-model="batchAlbumId" placeholder="选择相册">
        <el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" />
      </el-select>
      <el-button @click="runBatch">执行</el-button>
      <el-button type="primary" @click="load">搜索</el-button>
    </div>

    <el-table :data="photos" class="surface user-photo-table" scrollbar-always-on table-layout="auto" @selection-change="selection = $event">
      <el-table-column type="selection" width="46" />
      <el-table-column label="照片" width="104">
        <template #default="{ row }"><img class="table-thumb" :src="row.thumbnailUrl" :alt="row.title" /></template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="230" />
      <el-table-column label="可见性" min-width="126">
        <template #default="{ row }">
          <VisibilityToggleButton
            :value="row.visibility"
            :loading="visibilityBusyId === row.id"
            @toggle="toggleVisibility(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column label="数据" min-width="150">
        <template #default="{ row }">{{ row.viewCount }} 浏览</template>
      </el-table-column>
      <el-table-column label="操作" min-width="260">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <router-link :to="`/photos/${row.id}`"><el-button size="small">查看</el-button></router-link>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @update:page="load" @update:page-size="reload" />

    <el-dialog v-model="dialogVisible" title="编辑照片" width="620px" class="photo-edit-dialog" :lock-scroll="false">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-collapse v-if="isExternalPhoto(editForm)" v-model="urlCollapse" class="edit-collapse">
          <el-collapse-item name="url">
            <template #title>
              <span class="collapse-title">图片 URL</span>
              <span class="collapse-subtitle">{{ editForm.originalUrl || '未填写外链地址' }}</span>
            </template>
            <div class="external-url-fields">
              <el-form-item label="图片 URL"><el-input v-model="editForm.originalUrl" /></el-form-item>
              <el-form-item label="中图 URL"><el-input v-model="editForm.mediumUrl" /></el-form-item>
              <el-form-item label="缩略图 URL"><el-input v-model="editForm.thumbnailUrl" /></el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
        <div class="edit-grid">
          <el-form-item label="相册">
            <el-select v-model="editForm.albumId" clearable>
              <el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="可见性">
            <el-select v-model="editForm.visibility">
              <el-option label="公开" value="public" />
              <el-option label="私密" value="private" />
            </el-select>
          </el-form-item>
          <el-form-item class="location-editor-item" label="拍摄地点">
            <PhotoLocationEditor v-model="locationModel" collapsible :initial-open="false" />
          </el-form-item>
        </div>
        <el-collapse v-model="exifCollapse" class="edit-collapse exif-edit-collapse">
          <el-collapse-item name="exif">
            <template #title>
              <span class="collapse-title">EXIF 信息</span>
              <span class="collapse-subtitle">{{ exifSummary }}</span>
            </template>
            <div class="edit-grid exif-edit-grid">
              <el-form-item label="相机品牌"><el-input v-model="editForm.cameraMake" /></el-form-item>
              <el-form-item label="相机型号"><el-input v-model="editForm.cameraModel" /></el-form-item>
              <el-form-item label="镜头"><el-input v-model="editForm.lensModel" /></el-form-item>
              <el-form-item label="焦距 mm"><el-input v-model="editForm.focalLength" /></el-form-item>
              <el-form-item label="光圈"><el-input v-model="editForm.aperture" /></el-form-item>
              <el-form-item label="快门"><el-input v-model="editForm.shutterSpeed" /></el-form-item>
              <el-form-item label="ISO"><el-input-number v-model="editForm.iso" :min="0" /></el-form-item>
              <el-form-item label="曝光补偿"><el-input v-model="editForm.exposureCompensation" /></el-form-item>
              <el-form-item label="白平衡"><el-input v-model="editForm.whiteBalance" /></el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
        <el-form-item label="标签"><TagSelect v-model="editForm.tags" placeholder="选择标签" /></el-form-item>
        <el-form-item label="标记">
          <el-checkbox v-model="editForm.isPinned">置顶</el-checkbox>
          <el-checkbox v-model="editForm.isFeatured">精选</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '../../api/request.js';
import { albumApi } from '../../api/album.api.js';
import { photoApi } from '../../api/photo.api.js';
import Pagination from '../../components/common/Pagination.vue';
import VisibilityToggleButton from '../../components/common/VisibilityToggleButton.vue';
import TagSelect from '../../components/common/TagSelect.vue';
import PhotoLocationEditor from '../../components/map/PhotoLocationEditor.vue';
import { isExternalPhoto } from '../../utils/image.js';

const photos = ref([]);
const albums = ref([]);
const selection = ref([]);
const q = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const dialogVisible = ref(false);
const currentId = ref(null);
const batchAction = ref('');
const batchTags = ref([]);
const batchAlbumId = ref(null);
const editForm = reactive({});
const visibilityBusyId = ref(null);
const urlCollapse = ref([]);
const exifCollapse = ref([]);

const locationModel = computed({
  get: () => ({
    country: editForm.country || '',
    city: editForm.city || '',
    locationName: editForm.locationName || '',
    latitude: editForm.latitude ?? '',
    longitude: editForm.longitude ?? ''
  }),
  set: (value) => {
    editForm.country = value.country || '';
    editForm.city = value.city || '';
    editForm.locationName = value.locationName || '';
    editForm.latitude = value.latitude ?? '';
    editForm.longitude = value.longitude ?? '';
  }
});

const exifSummary = computed(() => {
  const aperture = String(editForm.aperture || '').trim();
  const parts = [
    editForm.cameraMake,
    editForm.cameraModel,
    editForm.lensModel,
    editForm.focalLength ? `${editForm.focalLength}mm` : '',
    aperture ? (aperture.toLowerCase().startsWith('f/') ? aperture : `f/${aperture}`) : '',
    editForm.iso ? `ISO ${editForm.iso}` : ''
  ].filter(Boolean);
  return parts.length ? parts.slice(0, 4).join(' · ') : '暂无 EXIF 信息';
});

const load = async () => {
  const res = await request.get('/my/photos', { params: { q: q.value, page: page.value, pageSize: pageSize.value } });
  photos.value = res.data;
  total.value = res.meta?.total || 0;
};

const reload = () => {
  page.value = 1;
  load();
};

const openEdit = (row) => {
  currentId.value = row.id;
  urlCollapse.value = [];
  exifCollapse.value = [];
  Object.assign(editForm, {
    title: row.title,
    description: row.description,
    originalUrl: row.originalUrl || '',
    mediumUrl: row.mediumUrl || '',
    thumbnailUrl: row.thumbnailUrl || '',
    mimeType: row.mimeType || '',
    fileSize: row.fileSize ?? null,
    albumId: row.albumId,
    visibility: row.visibility,
    country: row.country || '',
    city: row.city || '',
    locationName: row.locationName || '',
    latitude: row.latitude,
    longitude: row.longitude,
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
    isPinned: row.isPinned,
    isFeatured: row.isFeatured
  });
  dialogVisible.value = true;
};

const save = async () => {
  const payload = { ...editForm };
  if (!isExternalPhoto(editForm)) {
    delete payload.originalUrl;
    delete payload.mediumUrl;
    delete payload.thumbnailUrl;
  } else {
    payload.mediumUrl = payload.mediumUrl || payload.originalUrl;
    payload.thumbnailUrl = payload.thumbnailUrl || payload.mediumUrl || payload.originalUrl;
  }
  delete payload.sortOrder;
  delete payload.showInWaterfall;
  await photoApi.update(currentId.value, payload);
  ElMessage.success('已保存');
  dialogVisible.value = false;
  load();
};

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除「${row.title}」吗？`, '删除照片', { type: 'warning' });
  await photoApi.remove(row.id);
  ElMessage.success('已删除');
  load();
};

const toggleVisibility = async (row, visibility) => {
  visibilityBusyId.value = row.id;
  try {
    await photoApi.update(row.id, { visibility });
    row.visibility = visibility;
    ElMessage.success('可见性已更新');
  } finally {
    visibilityBusyId.value = null;
  }
};

const runBatch = async () => {
  if (!selection.value.length) return ElMessage.warning('请选择照片');
  if (batchAction.value === 'delete') await ElMessageBox.confirm('确定批量删除所选照片吗？', '批量删除', { type: 'warning' });
  for (const row of selection.value) {
    if (batchAction.value === 'delete') await photoApi.remove(row.id);
    if (batchAction.value === 'public' || batchAction.value === 'private') await photoApi.update(row.id, { visibility: batchAction.value });
    if (batchAction.value === 'tags') await photoApi.update(row.id, { tags: batchTags.value });
    if (batchAction.value === 'album') await photoApi.update(row.id, { albumId: batchAlbumId.value });
  }
  ElMessage.success('批量操作完成');
  load();
};

onMounted(async () => {
  const albumRes = await albumApi.list({ pageSize: 100 });
  albums.value = albumRes.data;
  await load();
});
</script>

<style scoped>
.toolbar {
  padding: 14px;
}

.toolbar .el-input,
.toolbar .el-select {
  width: 190px;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

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
  margin-top: 10px;
}

.user-photo-table {
  width: 100%;
}

.user-photo-table :deep(.cell) {
  white-space: nowrap;
}

.action-buttons {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.action-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
