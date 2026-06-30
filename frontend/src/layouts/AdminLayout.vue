<template>
  <div class="admin-layout">
    <aside class="admin-side">
      <router-link to="/" class="side-brand">{{ settings.siteName }}</router-link>
      <small>管理后台</small>
      <el-menu router :default-active="route.path" class="side-menu">
        <el-menu-item index="/admin">数据看板</el-menu-item>
        <el-menu-item index="/admin/users">用户管理</el-menu-item>
        <el-menu-item index="/admin/photos">照片管理</el-menu-item>
        <el-menu-item index="/admin/waterfall">瀑布流排序</el-menu-item>
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
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import FloatingDock from '../components/common/FloatingDock.vue';
import { useSettingsStore } from '../stores/settings.store.js';

const route = useRoute();
const settings = useSettingsStore();

const adminViewPrefetchers = [
  () => import('../views/admin/AdminDashboard.vue'),
  () => import('../views/admin/AdminUsers.vue'),
  () => import('../views/admin/AdminPhotos.vue'),
  () => import('../views/admin/AdminWaterfallOrder.vue'),
  () => import('../views/admin/AdminAlbums.vue'),
  () => import('../views/admin/AdminTags.vue'),
  () => import('../views/admin/AdminComments.vue'),
  () => import('../views/admin/AdminSettings.vue')
];

const warmAdminViews = () => {
  if (typeof window === 'undefined') return;

  const run = () => {
    adminViewPrefetchers.forEach((loadView) => {
      loadView().catch(() => {});
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1800 });
    return;
  }

  window.setTimeout(run, 350);
};

onMounted(warmAdminViews);
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
  padding: 24px 14px;
}

.side-brand {
  display: block;
  margin: 0 12px 4px;
  color: var(--theme-admin-side-text);
  font-size: 20px;
  font-weight: 900;
  line-height: 1.2;
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
  height: 42px;
  margin: 3px 0;
  border-radius: var(--theme-control-radius, var(--radius));
  color: var(--theme-text-soft);
  font-weight: 750;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.side-menu :deep(.el-menu-item.is-active),
.side-menu :deep(.el-menu-item:hover) {
  color: var(--theme-primary-strong);
  background: var(--theme-admin-side-hover);
}

.side-menu :deep(.el-menu-item.is-active) {
  box-shadow: inset 3px 0 0 var(--theme-primary);
}

.admin-main {
  min-width: 0;
  background:
    radial-gradient(circle at 78% 8%, color-mix(in srgb, var(--theme-primary) 8%, transparent), transparent 26%),
    var(--theme-page-bg);
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
