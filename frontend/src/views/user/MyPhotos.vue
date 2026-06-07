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
      <el-input v-if="batchAction === 'tags'" v-model="batchTags" placeholder="标签，逗号分隔" />
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
        <template #default="{ row }">{{ formatVisibility(row.visibility) }}</template>
      </el-table-column>
      <el-table-column prop="city" label="城市" min-width="150" />
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

    <el-dialog v-model="dialogVisible" title="编辑照片" width="620px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editForm.description" type="textarea" :rows="3" /></el-form-item>
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
          <el-form-item label="排序权重"><el-input-number v-model="editForm.sortOrder" /></el-form-item>
          <el-form-item label="纬度"><el-input v-model="editForm.latitude" /></el-form-item>
          <el-form-item label="经度"><el-input v-model="editForm.longitude" /></el-form-item>
        </div>
        <el-form-item label="标签"><el-input v-model="editForm.tags" /></el-form-item>
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
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '../../api/request.js';
import { albumApi } from '../../api/album.api.js';
import { photoApi } from '../../api/photo.api.js';
import Pagination from '../../components/common/Pagination.vue';
import { formatVisibility } from '../../utils/format.js';

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
const batchTags = ref('');
const batchAlbumId = ref(null);
const editForm = reactive({});

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
  Object.assign(editForm, {
    title: row.title,
    description: row.description,
    albumId: row.albumId,
    visibility: row.visibility,
    sortOrder: row.sortOrder,
    latitude: row.latitude,
    longitude: row.longitude,
    tags: row.tags?.map((item) => item.tag.name).join(', ') || '',
    isPinned: row.isPinned,
    isFeatured: row.isFeatured
  });
  dialogVisible.value = true;
};

const save = async () => {
  await photoApi.update(currentId.value, editForm);
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
