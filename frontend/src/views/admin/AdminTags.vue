<template>
  <section class="admin-page">
    <div class="section-head">
      <div><h1 class="section-title">标签管理</h1><p class="section-subtitle">新增、编辑、删除和合并标签。</p></div>
      <el-button type="primary" @click="openCreate">新增标签</el-button>
    </div>
    <div class="toolbar surface">
      <el-input v-model="keyword" clearable placeholder="搜索标签名称" />
      <el-select v-model="merge.sourceId" filterable placeholder="源标签"><el-option v-for="tag in items" :key="tag.id" :label="tag.name" :value="tag.id" /></el-select>
      <el-select v-model="merge.targetId" filterable placeholder="目标标签"><el-option v-for="tag in items" :key="tag.id" :label="tag.name" :value="tag.id" /></el-select>
      <el-button @click="mergeTags">合并标签</el-button>
    </div>
    <el-table :data="filteredItems" class="surface tag-table" table-layout="auto">
      <el-table-column label="标签名称" min-width="320">
        <template #default="{ row }">
          <span class="tag-preview">#{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="photoCount" label="照片数" min-width="140" />
      <el-table-column label="操作" min-width="200">
        <template #default="{ row }"><el-button size="small" @click="openEdit(row)">编辑</el-button><el-button size="small" type="danger" @click="remove(row)">删除</el-button></template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="currentId ? '编辑标签' : '新增标签'" width="480px">
      <el-form :model="form" label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-collapse class="advanced-panel">
          <el-collapse-item title="高级设置" name="advanced">
            <p class="form-tip">Slug 会自动生成，仅在需要固定英文/拼音标识时手动填写。标签颜色统一跟随系统主题。</p>
            <el-form-item label="Slug">
              <el-input v-model="form.slug" placeholder="留空自动生成" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';

const items = ref([]);
const dialogVisible = ref(false);
const currentId = ref(null);
const keyword = ref('');
const form = reactive({ name: '', slug: '' });
const merge = reactive({ sourceId: null, targetId: null });
const filteredItems = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((tag) =>
    [tag.name, tag.slug].some((value) => String(value || '').toLowerCase().includes(q))
  );
});
const load = async () => { const res = await adminApi.tags(); items.value = res.data; };
const openCreate = () => { currentId.value = null; Object.assign(form, { name: '', slug: '' }); dialogVisible.value = true; };
const openEdit = (row) => { currentId.value = row.id; Object.assign(form, { name: row.name || '', slug: row.slug || '' }); dialogVisible.value = true; };
const save = async () => {
  const payload = { ...form, slug: form.slug || undefined };
  if (currentId.value) await adminApi.updateTag(currentId.value, payload);
  else await adminApi.createTag(payload);
  ElMessage.success('已保存');
  dialogVisible.value = false;
  load();
};
const remove = async (row) => { await ElMessageBox.confirm(`确定删除标签 ${row.name} 吗？`, '删除标签', { type: 'warning' }); await adminApi.deleteTag(row.id); load(); };
const mergeTags = async () => { await adminApi.mergeTags(merge); ElMessage.success('已合并'); load(); };
onMounted(load);
</script>

<style scoped>
.toolbar {
  padding: 14px;
}
.toolbar .el-input,
.toolbar .el-select {
  width: 210px;
}
.tag-table {
  width: 100%;
}
.tag-preview {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--theme-tag-border);
  border-radius: 999px;
  color: var(--theme-tag-text);
  background: var(--theme-tag-bg);
  font-weight: 700;
}
.advanced-panel {
  border-top: 1px solid var(--theme-line);
  border-bottom: 1px solid var(--theme-line);
}
.form-tip,
.muted {
  color: var(--theme-muted-strong);
  font-size: 13px;
}
.form-tip {
  margin: 0 0 12px;
}
</style>
