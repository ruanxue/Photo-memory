<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">个人中心</h1>
        <p class="section-subtitle">管理你的照片、相册、收藏和资料。</p>
      </div>
      <router-link to="/user/upload"><el-button type="primary">上传照片</el-button></router-link>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><strong>{{ stats.photoCount || 0 }}</strong><span>我的照片</span></div>
      <div class="stat-card"><strong>{{ stats.albumCount || 0 }}</strong><span>我的相册</span></div>
      <div class="stat-card"><strong>{{ stats.viewCount || 0 }}</strong><span>浏览量</span></div>
      <div class="stat-card"><strong>{{ stats.favoriteCount || 0 }}</strong><span>收藏</span></div>
      <div class="stat-card"><strong>{{ stats.commentCount || 0 }}</strong><span>评论</span></div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import request from '../../api/request.js';

const stats = ref({});

onMounted(async () => {
  const res = await request.get('/my/statistics');
  stats.value = res.data;
});
</script>
