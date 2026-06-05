<template>
  <section class="section">
    <div class="container">
      <EmptyState title="403" description="你没有访问该页面的权限。">
        <router-link to="/"><el-button type="primary">返回首页</el-button></router-link>
      </EmptyState>
    </div>
  </section>
</template>

<script setup>
import EmptyState from '../../components/common/EmptyState.vue';
</script>
