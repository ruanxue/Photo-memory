<template>
  <section class="page-hero container">
    <h1>时间轴</h1>
    <p>按年份、月份和日期回看旅行行纪与生活片段。</p>
  </section>
  <section class="section">
    <div class="container">
      <div class="toolbar surface">
        <el-input v-model="city" placeholder="按城市筛选" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">筛选</el-button>
      </div>
      <LoadingState v-if="loading" />
      <TimelineList v-else :timeline="timeline" />
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import request from '../../api/request.js';
import LoadingState from '../../components/common/LoadingState.vue';
import TimelineList from '../../components/common/TimelineList.vue';

const timeline = ref([]);
const loading = ref(true);
const city = ref('');

const load = async () => {
  loading.value = true;
  try {
    const res = await request.get('/timeline', { params: { city: city.value || undefined } });
    timeline.value = res.data;
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.toolbar {
  padding: 14px;
}

.toolbar .el-input {
  width: 220px;
}
</style>
