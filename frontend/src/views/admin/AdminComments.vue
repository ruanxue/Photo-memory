<template>
  <section class="admin-page">
    <div class="section-head">
      <div><h1 class="section-title">评论管理</h1><p class="section-subtitle">审核、驳回和删除评论。</p></div>
    </div>
    <el-table :data="comments" class="surface">
      <el-table-column label="照片" width="92"><template #default="{ row }"><img class="table-thumb" :src="row.photo?.thumbnailUrl" /></template></el-table-column>
      <el-table-column prop="photo.title" label="照片标题" min-width="150" />
      <el-table-column label="用户" width="120"><template #default="{ row }">{{ row.user?.nickname || row.user?.username || row.guestName || '访客' }}</template></el-table-column>
      <el-table-column label="访客邮箱" min-width="180"><template #default="{ row }">{{ row.guestEmail || '-' }}</template></el-table-column>
      <el-table-column label="来源 IP" min-width="135"><template #default="{ row }">{{ row.ip || '-' }}</template></el-table-column>
      <el-table-column prop="content" label="内容" min-width="260" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ formatCommentStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="250">
        <template #default="{ row }">
          <el-button size="small" @click="setStatus(row, 'approved')">通过</el-button>
          <el-button size="small" @click="setStatus(row, 'rejected')">驳回</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import { formatCommentStatus } from '../../utils/format.js';

const comments = ref([]);
const load = async () => { const res = await adminApi.comments(); comments.value = res.data; };
const setStatus = async (row, status) => { await adminApi.updateCommentStatus(row.id, { status }); ElMessage.success('状态已更新'); load(); };
const remove = async (row) => { await ElMessageBox.confirm('确定删除这条评论吗？', '删除评论', { type: 'warning' }); await adminApi.deleteComment(row.id); load(); };
onMounted(load);
</script>
