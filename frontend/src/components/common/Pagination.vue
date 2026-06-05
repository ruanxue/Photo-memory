<template>
  <div v-if="total > pageSize" class="pager">
    <el-pagination
      background
      layout="prev, pager, next, sizes, total"
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="[12, 20, 30, 48]"
      :total="total"
      @current-change="$emit('update:page', $event)"
      @size-change="$emit('update:pageSize', $event)"
    />
  </div>
</template>

<script setup>
defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true }
});

defineEmits(['update:page', 'update:pageSize']);
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: center;
  margin-top: 26px;
}
</style>
