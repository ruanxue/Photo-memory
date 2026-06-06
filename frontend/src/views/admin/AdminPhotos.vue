<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">照片管理</h1>
        <p class="section-subtitle">审核、编辑、删除、置顶、精选和批量修改照片。</p>
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
      <el-input v-if="batch.action === 'tags'" v-model="batch.tags" placeholder="标签，逗号分隔" />
      <el-button @click="runBatch">执行</el-button>
      <el-button type="primary" @click="load">搜索</el-button>
    </div>
    <el-table :data="photos" class="surface admin-photo-table" scrollbar-always-on @selection-change="selection = $event">
      <el-table-column type="selection" width="46" />
      <el-table-column label="图" width="92"><template #default="{ row }"><img class="table-thumb" :src="row.thumbnailUrl" /></template></el-table-column>
      <el-table-column prop="title" label="标题" width="150" />
      <el-table-column label="作者" width="96"><template #default="{ row }">{{ row.user?.nickname || row.user?.username }}</template></el-table-column>
      <el-table-column label="可见性" width="90">
        <template #default="{ row }">{{ formatVisibility(row.visibility) }}</template>
      </el-table-column>
      <el-table-column prop="city" label="城市" width="130" />
      <el-table-column label="状态" width="130"><template #default="{ row }">{{ row.isPinned ? '置顶 ' : '' }}{{ row.isFeatured ? '精选' : '' }}</template></el-table-column>
      <el-table-column label="操作" width="330">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="pin(row)">{{ row.isPinned ? '取消置顶' : '置顶' }}</el-button>
            <el-button size="small" @click="feature(row)">{{ row.isFeatured ? '取消精选' : '精选' }}</el-button>
            <router-link :to="`/photos/${row.id}`"><el-button size="small">查看</el-button></router-link>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @update:page="load" @update:page-size="reload" />

    <el-dialog v-model="dialogVisible" title="编辑照片" width="680px">
      <el-form :model="form" label-position="top">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <div class="edit-grid">
          <el-form-item label="相册"><el-select v-model="form.albumId" clearable><el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" /></el-select></el-form-item>
          <el-form-item label="可见性"><el-select v-model="form.visibility"><el-option label="公开" value="public" /><el-option label="私密" value="private" /></el-select></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="form.sortOrder" /></el-form-item>
          <el-form-item label="城市"><el-input v-model="form.city" /></el-form-item>
          <el-form-item label="地点"><el-input v-model="form.locationName" /></el-form-item>
          <el-form-item label="纬度"><el-input v-model="form.latitude" /></el-form-item>
          <el-form-item label="经度"><el-input v-model="form.longitude" /></el-form-item>
        </div>
        <el-form-item label="标签"><el-input v-model="form.tags" /></el-form-item>
        <el-checkbox v-model="form.isPinned">置顶</el-checkbox>
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
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import { albumApi } from '../../api/album.api.js';
import Pagination from '../../components/common/Pagination.vue';
import { formatVisibility } from '../../utils/format.js';

const photos = ref([]);
const albums = ref([]);
const selection = ref([]);
const q = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const currentId = ref(null);
const dialogVisible = ref(false);
const batch = reactive({ action: '', tags: '' });
const form = reactive({});

const load = async () => {
  const res = await adminApi.photos({ q: q.value, page: page.value, pageSize: pageSize.value });
  photos.value = res.data;
  total.value = res.meta?.total || 0;
};
const reload = () => { page.value = 1; load(); };
const openEdit = (row) => {
  currentId.value = row.id;
  Object.keys(form).forEach((key) => delete form[key]);
  Object.assign(form, {
    title: row.title || '',
    description: row.description || '',
    albumId: row.albumId || null,
    visibility: row.visibility || 'public',
    sortOrder: row.sortOrder ?? 0,
    city: row.city || '',
    locationName: row.locationName || '',
    latitude: row.latitude ?? '',
    longitude: row.longitude ?? '',
    tags: row.tags?.map((item) => item.tag.name).join(', ') || '',
    isPinned: Boolean(row.isPinned),
    isFeatured: Boolean(row.isFeatured)
  });
  dialogVisible.value = true;
};
const save = async () => { await adminApi.updatePhoto(currentId.value, form); ElMessage.success('已保存'); dialogVisible.value = false; load(); };
const pin = async (row) => { await adminApi.pinPhoto(row.id, { isPinned: !row.isPinned }); load(); };
const feature = async (row) => { await adminApi.featurePhoto(row.id, { isFeatured: !row.isFeatured }); load(); };
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
  const albumRes = await albumApi.list({ pageSize: 100 });
  albums.value = albumRes.data;
  await load();
});
</script>

<style scoped>
.toolbar { padding: 14px; }
.toolbar .el-input, .toolbar .el-select { width: 190px; }
.edit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.admin-photo-table {
  width: 100%;
}
.admin-photo-table :deep(.cell) {
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
