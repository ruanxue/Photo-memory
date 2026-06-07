<template>
  <div class="workspace-layout">
    <aside class="workspace-side">
      <router-link to="/" class="side-brand">{{ settings.siteName }}</router-link>
      <el-menu router :default-active="route.path" class="side-menu">
        <el-menu-item index="/user">我的统计</el-menu-item>
        <el-menu-item index="/user/photos">我的照片</el-menu-item>
        <el-menu-item index="/user/upload">上传照片</el-menu-item>
        <el-menu-item index="/user/albums">我的相册</el-menu-item>
        <el-menu-item index="/user/favorites">我的收藏</el-menu-item>
        <el-menu-item index="/user/comments">我的评论</el-menu-item>
        <el-menu-item index="/user/profile">个人资料</el-menu-item>
        <el-menu-item index="/user/password">修改密码</el-menu-item>
      </el-menu>
    </aside>
    <section class="workspace-main">
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
.workspace-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 230px 1fr;
  background: var(--page-bg);
}

.workspace-side {
  border-right: 1px solid var(--line);
  background: var(--admin-side-bg);
  padding: 20px 12px;
}

.side-brand {
  display: block;
  padding: 8px 12px 22px;
  color: var(--admin-side-text);
  font-size: 20px;
  font-weight: 900;
}

.side-menu {
  border-right: 0;
  background: transparent;
}

.workspace-main {
  min-width: 0;
  padding-top: 0;
}

@media (max-width: 860px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }

  .workspace-side {
    position: sticky;
    top: 0;
    z-index: 20;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .side-menu {
    display: flex;
    overflow-x: auto;
  }
}
</style>
