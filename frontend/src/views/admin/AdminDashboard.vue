<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">数据看板</h1>
        <p class="section-subtitle">站点整体统计、热门内容和最近上传。</p>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><strong>{{ stats.photoCount || 0 }}</strong><span>照片总数</span></div>
      <div class="stat-card"><strong>{{ stats.userCount || 0 }}</strong><span>用户总数</span></div>
      <div class="stat-card"><strong>{{ stats.albumCount || 0 }}</strong><span>相册总数</span></div>
      <div class="stat-card"><strong>{{ stats.commentCount || 0 }}</strong><span>评论总数</span></div>
      <div class="stat-card"><strong>{{ stats.todayUploads || 0 }}</strong><span>今日上传</span></div>
      <div class="stat-card"><strong>{{ stats.monthUploads || 0 }}</strong><span>本月上传</span></div>
    </div>
    <div class="dashboard-grid">
      <div class="surface panel">
        <h2>热门照片</h2>
        <div v-for="photo in stats.popularPhotos || []" :key="photo.id" class="rank-row">
          <img :src="photo.thumbnailUrl" />
          <span>{{ photo.title }}</span>
          <small>{{ photo.viewCount }} 浏览</small>
        </div>
      </div>
      <div class="surface panel">
        <h2>热门标签</h2>
        <div class="tag-bars">
          <div v-for="tag in stats.popularTags || []" :key="tag.id">
            <span>{{ tag.name }}</span>
            <b :style="{ width: `${Math.min((tag.photoCount || 1) * 12, 100)}%` }"></b>
          </div>
        </div>
      </div>
      <div class="surface panel">
        <h2>最近上传</h2>
        <div v-for="photo in stats.recentPhotos || []" :key="photo.id" class="rank-row">
          <img :src="photo.thumbnailUrl" />
          <span>{{ photo.title }}</span>
          <small>{{ formatDate(photo.createdAt) }}</small>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { adminApi } from '../../api/admin.api.js';
import { formatDate } from '../../utils/format.js';

const stats = ref({});
onMounted(async () => {
  const res = await adminApi.statistics();
  stats.value = res.data;
});
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.panel {
  padding: 18px;
}

.rank-row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--theme-line);
}

.rank-row img {
  width: 64px;
  height: 44px;
  object-fit: cover;
  border-radius: 6px;
}

.rank-row small {
  color: var(--theme-muted-strong);
}

.tag-bars {
  display: grid;
  gap: 12px;
}

.tag-bars div {
  display: grid;
  gap: 6px;
}

.tag-bars b {
  height: 8px;
  border-radius: 999px;
  background: var(--theme-primary);
}
</style>
