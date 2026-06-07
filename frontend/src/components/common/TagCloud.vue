<template>
  <div class="tag-cloud">
    <router-link v-for="tag in tags" :key="tag.id" :to="`/tags/${tag.id}`" :style="{ '--tag-color': tag.color || '#8fb8c4' }">
      #{{ tag.name }}
      <span>{{ tag.photoCount }}</span>
    </router-link>
  </div>
</template>

<script setup>
defineProps({
  tags: { type: Array, default: () => [] }
});
</script>

<style scoped>
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

a {
  padding: 8px 12px;
  border-radius: 999px;
  color: var(--text);
  border: 1px solid color-mix(in srgb, var(--tag-color) 52%, var(--line));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--tag-color) 20%, transparent), var(--button-bg));
  box-shadow: inset 0 0 0 1px var(--line-faint);
}

span {
  color: var(--primary-strong);
  margin-left: 6px;
}
</style>
