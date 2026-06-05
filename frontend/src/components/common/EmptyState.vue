<template>
  <div class="empty-state">
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '暂无内容' },
  description: { type: String, default: '换个筛选条件或稍后再看看。' }
});
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 42px 20px;
  background: var(--surface-glass);
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  color: var(--muted-strong);
}

.empty-state strong {
  display: block;
  color: var(--text);
  font-size: 18px;
  margin-bottom: 8px;
}
</style>
