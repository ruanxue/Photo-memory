<template>
  <div class="admin-layout">
    <aside class="admin-side">
      <router-link to="/" class="side-brand">{{ settings.siteName }}</router-link>
      <small>管理后台</small>
      <el-menu router :default-active="route.path" class="side-menu">
        <el-menu-item index="/admin">数据看板</el-menu-item>
        <el-menu-item index="/admin/users">用户管理</el-menu-item>
        <el-menu-item index="/admin/photos">照片管理</el-menu-item>
        <el-menu-item index="/admin/albums">相册管理</el-menu-item>
        <el-menu-item index="/admin/tags">标签管理</el-menu-item>
        <el-menu-item index="/admin/comments">评论管理</el-menu-item>
        <el-menu-item index="/admin/settings">系统设置</el-menu-item>
      </el-menu>
    </aside>
    <section class="admin-main">
      <router-view />
    </section>
    <FloatingDock />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import FloatingDock from '../components/common/FloatingDock.vue';
import { useSettingsStore } from '../stores/settings.store.js';

const route = useRoute();
const settings = useSettingsStore();
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 236px 1fr;
}

.admin-side {
  background: var(--theme-admin-side-bg);
  color: var(--theme-admin-side-text);
  border-right: 1px solid var(--theme-line);
  padding: 22px 12px;
}

.side-brand {
  display: block;
  margin: 0 12px 4px;
  color: var(--theme-admin-side-text);
  font-size: 20px;
  font-weight: 900;
}

.admin-side small {
  display: block;
  margin: 0 12px 18px;
  color: var(--theme-admin-side-muted);
}

.side-menu {
  border: 0;
  background: transparent;
}

.side-menu :deep(.el-menu-item) {
  color: var(--theme-text-soft);
}

.side-menu :deep(.el-menu-item.is-active),
.side-menu :deep(.el-menu-item:hover) {
  color: var(--theme-primary-strong);
  background: var(--theme-admin-side-hover);
}

.admin-main {
  min-width: 0;
  background: var(--theme-page-bg);
}

@media (max-width: 900px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-side {
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .side-menu {
    display: flex;
    overflow-x: auto;
  }
}
</style>
