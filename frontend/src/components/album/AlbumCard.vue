<template>
  <router-link :to="`/albums/${album.id}`" class="album-card">
    <img :src="albumCover(album)" :alt="album.title" loading="lazy" />
    <div>
      <strong>{{ album.title }}</strong>
      <p>{{ album.description || '没有描述，照片自己会说话。' }}</p>
      <span>{{ album.photoCount || album.photos?.length || 0 }} 张照片</span>
    </div>
  </router-link>
</template>

<script setup>
import { albumCover } from '../../utils/image.js';

defineProps({
  album: { type: Object, required: true }
});
</script>

<style scoped>
.album-card {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 16px;
  min-height: 132px;
  padding: 12px;
  background: var(--surface-glass);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.album-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

img {
  width: 132px;
  height: 108px;
  object-fit: cover;
  border-radius: 6px;
}

strong {
  display: block;
  font-size: 18px;
  margin-bottom: 8px;
}

p {
  color: var(--muted-strong);
  line-height: 1.6;
  margin: 0 0 10px;
}

span {
  color: var(--primary);
}

@media (max-width: 560px) {
  .album-card {
    grid-template-columns: 1fr;
  }

  img {
    width: 100%;
    height: 180px;
  }
}
</style>
