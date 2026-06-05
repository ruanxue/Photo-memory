<template>
  <section class="admin-page">
    <div class="section-head">
      <div><h1 class="section-title">相册管理</h1><p class="section-subtitle">新增、编辑、删除、置顶和公开控制。</p></div>
      <el-button type="primary" @click="openCreate">新增相册</el-button>
    </div>
    <el-table :data="albums" class="surface">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="卡片头图" width="106">
        <template #default="{ row }"><img class="album-thumb" :src="albumCover(row)" :alt="row.title" /></template>
      </el-table-column>
      <el-table-column prop="title" label="标题" />
      <el-table-column label="作者" width="120"><template #default="{ row }">{{ row.user?.nickname || row.user?.username }}</template></el-table-column>
      <el-table-column label="可见性" width="100">
        <template #default="{ row }">{{ formatVisibility(row.visibility) }}</template>
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
    <el-dialog v-model="dialogVisible" :title="currentId ? '编辑相册' : '新增相册'" width="560px">
      <el-form :model="form" label-position="top">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="可见性"><el-select v-model="form.visibility"><el-option label="公开" value="public" /><el-option label="私密" value="private" /></el-select></el-form-item>
        <el-form-item label="卡片头图照片 ID">
          <el-input v-model="form.coverPhotoId" placeholder="输入相册内照片 ID，留空则自动使用第一张" />
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
import { albumCover } from '../../utils/image.js';
import { formatVisibility } from '../../utils/format.js';

const albums = ref([]);
const dialogVisible = ref(false);
const currentId = ref(null);
const form = reactive({ title: '', description: '', visibility: 'public', isPinned: false, sortOrder: 0, coverPhotoId: null });
const load = async () => { const res = await adminApi.albums(); albums.value = res.data; };
const openCreate = () => { currentId.value = null; Object.assign(form, { title: '', description: '', visibility: 'public', isPinned: false, sortOrder: 0, coverPhotoId: null }); dialogVisible.value = true; };
const openEdit = (row) => { currentId.value = row.id; Object.assign(form, row); dialogVisible.value = true; };
const save = async () => { if (currentId.value) await adminApi.updateAlbum(currentId.value, form); else await adminApi.createAlbum(form); ElMessage.success('已保存'); dialogVisible.value = false; load(); };
const remove = async (row) => { await ElMessageBox.confirm(`确定删除相册 ${row.title} 吗？`, '删除相册', { type: 'warning' }); await adminApi.deleteAlbum(row.id); load(); };
onMounted(load);
</script>

<style scoped>
.album-thumb {
  width: 76px;
  height: 52px;
  border-radius: 4px;
  object-fit: cover;
}
</style>
