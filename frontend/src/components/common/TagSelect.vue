<template>
  <el-select
    :model-value="modelValue"
    multiple
    filterable
    clearable
    collapse-tags
    collapse-tags-tooltip
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.name" />
  </el-select>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { tagApi } from '../../api/tag.api.js';

let cachedTags = null;
let loadingPromise = null;

defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '选择标签' }
});

const emit = defineEmits(['update:modelValue']);
const tags = ref([]);

onMounted(async () => {
  if (cachedTags) {
    tags.value = cachedTags;
    return;
  }
  if (!loadingPromise) {
    loadingPromise = tagApi.list().then((res) => {
      cachedTags = res.data || [];
      return cachedTags;
    });
  }
  tags.value = await loadingPromise;
});
</script>
