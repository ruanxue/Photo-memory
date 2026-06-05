<template>
  <section class="page-hero container">
    <h1>相册</h1>
    <p>按旅行、城市、生活片段和摄影主题归档。</p>
  </section>
  <section class="section">
    <div class="container">
      <LoadingState v-if="loading" />
      <div v-else class="album-grid">
        <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
      </div>
      <EmptyState v-if="!loading && !albums.length" title="暂无相册" description="创建相册后会出现在这里。" />
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { albumApi } from '../../api/album.api.js';
import AlbumCard from '../../components/album/AlbumCard.vue';
import LoadingState from '../../components/common/LoadingState.vue';
import EmptyState from '../../components/common/EmptyState.vue';

const albums = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await albumApi.list({ pageSize: 60 });
    albums.value = res.data;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}
</style>
