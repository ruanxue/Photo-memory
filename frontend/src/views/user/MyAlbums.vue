<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">我的相册</h1>
        <p class="section-subtitle">创建、编辑和管理相册公开状态。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建相册</el-button>
    </div>
    <div class="album-grid">
      <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
    </div>
    <el-table :data="albums" class="surface admin-list">
      <el-table-column prop="title" label="标题" />
      <el-table-column label="可见性" width="100">
        <template #default="{ row }">
          <VisibilityToggleButton
            :value="row.visibility"
            :loading="visibilityBusyId === row.id"
            @toggle="toggleVisibility(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="photoCount" label="照片数" width="100" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <router-link :to="`/albums/${row.id}`"><el-button size="small">查看</el-button></router-link>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="currentId ? '编辑相册' : '新建相册'" width="520px">
      <el-form :model="form" label-position="top">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="可见性">
          <el-select v-model="form.visibility">
            <el-option label="公开" value="public" />
            <el-option label="私密" value="private" />
          </el-select>
        </el-form-item>
        <el-form-item label="卡片头图">
          <AlbumCoverSelector v-loading="coverLoading" v-model="form.coverPhotoId" :photos="coverPhotos" />
        </el-form-item>
        <el-form-item label="排序权重"><el-input-number v-model="form.sortOrder" /></el-form-item>
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
import AlbumCard from '../../components/album/AlbumCard.vue';
import AlbumCoverSelector from '../../components/album/AlbumCoverSelector.vue';
import VisibilityToggleButton from '../../components/common/VisibilityToggleButton.vue';

const albums = ref([]);
const dialogVisible = ref(false);
const currentId = ref(null);
const form = reactive({ title: '', description: '', visibility: 'public', coverPhotoId: null, sortOrder: 0 });
const coverPhotos = ref([]);
const coverLoading = ref(false);
const visibilityBusyId = ref(null);

const load = async () => {
  const res = await request.get('/my/albums');
  albums.value = res.data;
};

const openCreate = () => {
  currentId.value = null;
  Object.assign(form, { title: '', description: '', visibility: 'public', coverPhotoId: null, sortOrder: 0 });
  coverPhotos.value = [];
  dialogVisible.value = true;
};

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

const save = async () => {
  if (currentId.value) await albumApi.update(currentId.value, form);
  else await albumApi.create(form);
  ElMessage.success('已保存');
  dialogVisible.value = false;
  load();
};

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除相册「${row.title}」吗？`, '删除相册', { type: 'warning' });
  await albumApi.remove(row.id);
  ElMessage.success('已删除');
  load();
};

const toggleVisibility = async (row, visibility) => {
  visibilityBusyId.value = row.id;
  try {
    await albumApi.update(row.id, { ...row, visibility, coverPhotoId: row.coverPhotoId || null });
    row.visibility = visibility;
    ElMessage.success('可见性已更新');
  } finally {
    visibilityBusyId.value = null;
  }
};

onMounted(load);
</script>

<style scoped>
.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.admin-list {
  margin-top: 20px;
}
</style>
