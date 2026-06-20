<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">上传照片</h1>
        <p class="section-subtitle">可以上传本地文件，也可以填写图床图片 URL；外链照片会直接从图床加载，不占用服务器流量。</p>
      </div>
    </div>
    <UploadPanel @uploaded="$router.push('/user/photos')" />
  </section>
</template>

<script setup>
import UploadPanel from '../../components/upload/UploadPanel.vue';
</script>
