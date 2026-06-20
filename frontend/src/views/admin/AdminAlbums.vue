<template>
  <section class="admin-page">
    <div class="section-head">
      <div><h1 class="section-title">相册管理</h1><p class="section-subtitle">新增、编辑、删除、置顶和公开控制。</p></div>
      <el-button type="primary" @click="openCreate">新增相册</el-button>
    </div>
    <el-table :data="albums" class="surface admin-album-table" scrollbar-always-on table-layout="auto">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="卡片头图" width="120">
        <template #default="{ row }"><img class="album-thumb" :src="albumCover(row)" :alt="row.title" /></template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="230" />
      <el-table-column label="作者" min-width="160"><template #default="{ row }">{{ row.user?.nickname || row.user?.username }}</template></el-table-column>
      <el-table-column label="可见性" min-width="130">
        <template #default="{ row }">
          <VisibilityToggleButton
            :value="row.visibility"
            :loading="visibilityBusyId === row.id"
            @toggle="toggleVisibility(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="photoCount" label="照片数" min-width="130" />
      <el-table-column label="操作" min-width="260">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <router-link :to="`/albums/${row.id}`"><el-button size="small">查看</el-button></router-link>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="currentId ? '编辑相册' : '新增相册'" width="560px">
      <el-form :model="form" label-position="top">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="可见性"><el-select v-model="form.visibility"><el-option label="公开" value="public" /><el-option label="私密" value="private" /></el-select></el-form-item>
        <el-form-item label="卡片头图">
          <AlbumCoverSelector v-loading="coverLoading" v-model="form.coverPhotoId" :photos="coverPhotos" />
        </el-form-item>
        <el-checkbox v-model="form.isPinned">置顶</el-checkbox>
        <el-form-item label="排序权重"><el-input-number v-model="form.sortOrder" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import { albumApi } from '../../api/album.api.js';
import AlbumCoverSelector from '../../components/album/AlbumCoverSelector.vue';
import VisibilityToggleButton from '../../components/common/VisibilityToggleButton.vue';
import { albumCover } from '../../utils/image.js';

const albums = ref([]);
const dialogVisible = ref(false);
const currentId = ref(null);
const form = reactive({ title: '', description: '', visibility: 'public', isPinned: false, sortOrder: 0, coverPhotoId: null });
const coverPhotos = ref([]);
const coverLoading = ref(false);
const visibilityBusyId = ref(null);
const load = async () => { const res = await adminApi.albums(); albums.value = res.data; };
const openCreate = () => { currentId.value = null; coverPhotos.value = []; Object.assign(form, { title: '', description: '', visibility: 'public', isPinned: false, sortOrder: 0, coverPhotoId: null }); dialogVisible.value = true; };
const openEdit = async (row) => {
  currentId.value = row.id;
  Object.assign(form, row);
  coverPhotos.value = [];
  dialogVisible.value = true;
  coverLoading.value = true;
  try {
    const res = await albumApi.detail(row.id);
    coverPhotos.value = res.data?.photos || [];
    form.coverPhotoId = row.coverPhotoId || res.data?.coverPhotoId || null;
  } finally {
    coverLoading.value = false;
  }
};
const save = async () => { if (currentId.value) await adminApi.updateAlbum(currentId.value, form); else await adminApi.createAlbum(form); ElMessage.success('已保存'); dialogVisible.value = false; load(); };
const remove = async (row) => { await ElMessageBox.confirm(`确定删除相册 ${row.title} 吗？`, '删除相册', { type: 'warning' }); await adminApi.deleteAlbum(row.id); load(); };
const toggleVisibility = async (row, visibility) => {
  visibilityBusyId.value = row.id;
  try {
    await adminApi.updateAlbum(row.id, { ...row, visibility, coverPhotoId: row.coverPhotoId || null });
    row.visibility = visibility;
    ElMessage.success('可见性已更新');
  } finally {
    visibilityBusyId.value = null;
  }
};
onMounted(load);
</script>

<style scoped>
.album-thumb {
  width: 76px;
  height: 52px;
  border-radius: 4px;
  object-fit: cover;
}
.admin-album-table {
  width: 100%;
}
.admin-album-table :deep(.cell) {
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
