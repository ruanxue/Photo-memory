<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">我的评论</h1>
        <p class="section-subtitle">查看你发出的评论和审核状态。</p>
      </div>
    </div>
    <el-table :data="comments" class="surface">
      <el-table-column label="照片" width="94"><template #default="{ row }"><img class="table-thumb" :src="row.photo?.thumbnailUrl" /></template></el-table-column>
      <el-table-column prop="photo.title" label="照片标题" min-width="160" />
      <el-table-column prop="content" label="评论" min-width="260" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ formatCommentStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template></el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import request from '../../api/request.js';
import { formatCommentStatus, formatDateTime } from '../../utils/format.js';

const comments = ref([]);
onMounted(async () => {
  const res = await request.get('/my/comments');
  comments.value = res.data;
});
</script>
