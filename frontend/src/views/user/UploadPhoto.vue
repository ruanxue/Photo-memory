<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">上传照片</h1>
        <p class="section-subtitle">上传后自动生成缩略图和中图，并尝试读取 EXIF 与 GPS。</p>
      </div>
    </div>
    <UploadPanel @uploaded="$router.push('/user/photos')" />
  </section>
</template>

<script setup>
import UploadPanel from '../../components/upload/UploadPanel.vue';
</script>
