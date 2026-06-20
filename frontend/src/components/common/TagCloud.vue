<template>
  <div class="tag-cloud">
    <router-link v-for="tag in tags" :key="tag.id" :to="{ path: '/photos', query: { tagId: tag.id } }">
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
  color: var(--theme-tag-text);
  border: 1px solid var(--theme-tag-border);
  background: var(--theme-tag-bg);
  box-shadow: inset 0 0 0 1px var(--theme-line-faint);
}

span {
  color: var(--theme-tag-text);
  margin-left: 6px;
}
</style>
