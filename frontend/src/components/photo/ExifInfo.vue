<template>
  <div class="exif-grid">
    <div v-for="[label, value] in rows" :key="label" class="exif-item">
      <span>{{ label }}</span>
      <strong>{{ value }}</strong>
    </div>
    <EmptyState v-if="!rows.length" title="暂无照片参数" description="上传后可手动补充 EXIF 信息。" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { exifRows } from '../../utils/exif.js';
import EmptyState from '../common/EmptyState.vue';

const props = defineProps({
  photo: { type: Object, default: null }
});

const rows = computed(() => exifRows(props.photo));
</script>

<style scoped>
.exif-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.exif-item {
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  background: var(--theme-surface-glass);
}

.exif-item span {
  display: block;
  color: var(--theme-muted-strong);
  font-size: 12px;
  margin-bottom: 6px;
}

.exif-item strong {
  font-size: 15px;
}
</style>
