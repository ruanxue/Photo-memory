<template>
  <section class="admin-page">
    <div class="section-head">
      <div><h1 class="section-title">标签管理</h1><p class="section-subtitle">新增、编辑、删除和合并标签。</p></div>
      <el-button type="primary" @click="openCreate">新增标签</el-button>
    </div>
    <div class="toolbar surface">
      <el-select v-model="merge.sourceId" placeholder="源标签"><el-option v-for="tag in items" :key="tag.id" :label="tag.name" :value="tag.id" /></el-select>
      <el-select v-model="merge.targetId" placeholder="目标标签"><el-option v-for="tag in items" :key="tag.id" :label="tag.name" :value="tag.id" /></el-select>
      <el-button @click="mergeTags">合并标签</el-button>
    </div>
    <el-table :data="items" class="surface">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="slug" label="Slug" />
      <el-table-column prop="color" label="颜色" width="120"><template #default="{ row }"><el-tag :color="row.color" effect="plain">{{ row.color }}</el-tag></template></el-table-column>
      <el-table-column prop="photoCount" label="照片数" width="100" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }"><el-button size="small" @click="openEdit(row)">编辑</el-button><el-button size="small" type="danger" @click="remove(row)">删除</el-button></template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="currentId ? '编辑标签' : '新增标签'" width="480px">
      <el-form :model="form" label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="Slug"><el-input v-model="form.slug" /></el-form-item>
        <el-form-item label="颜色"><el-color-picker v-model="form.color" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';

const items = ref([]);
const dialogVisible = ref(false);
const currentId = ref(null);
const form = reactive({ name: '', slug: '', color: '#eef2ff' });
const merge = reactive({ sourceId: null, targetId: null });
const load = async () => { const res = await adminApi.tags(); items.value = res.data; };
const openCreate = () => { currentId.value = null; Object.assign(form, { name: '', slug: '', color: '#eef2ff' }); dialogVisible.value = true; };
const openEdit = (row) => { currentId.value = row.id; Object.assign(form, row); dialogVisible.value = true; };
const save = async () => { if (currentId.value) await adminApi.updateTag(currentId.value, form); else await adminApi.createTag(form); ElMessage.success('已保存'); dialogVisible.value = false; load(); };
const remove = async (row) => { await ElMessageBox.confirm(`确定删除标签 ${row.name} 吗？`, '删除标签', { type: 'warning' }); await adminApi.deleteTag(row.id); load(); };
const mergeTags = async () => { await adminApi.mergeTags(merge); ElMessage.success('已合并'); load(); };
onMounted(load);
</script>

<style scoped>
.toolbar { padding: 14px; }
.toolbar .el-select { width: 180px; }
</style>
