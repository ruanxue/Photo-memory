<template>
  <Transition name="dock-fade">
    <nav v-show="visible" class="floating-dock" :class="{ 'floating-dock-home': home }" aria-label="快捷导航">
      <router-link v-for="item in links" :key="item.key" :to="item.to" custom v-slot="{ href, navigate }">
        <a :href="href" :aria-label="item.label" :class="{ active: isActive(item) }" @click="handleNavigate($event, item, navigate)">
          <el-icon><component :is="item.icon" /></el-icon>
        </a>
      </router-link>
    </nav>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus/es/components/message/index';
import { Clock, Collection, HomeFilled, Location, Picture, Setting, User } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth.store.js';
import { useSettingsStore } from '../../stores/settings.store.js';

defineProps({
  visible: { type: Boolean, default: true },
  home: { type: Boolean, default: false }
});

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();

const links = computed(() => {
  const items = [
    { key: 'home', to: '/', label: '首页', icon: HomeFilled },
    { key: 'photos', to: '/photos', label: '照片墙', icon: Picture },
    { key: 'albums', to: '/albums', label: '相册', icon: Collection },
    { key: 'timeline', to: '/timeline', label: '时间轴', icon: Clock },
    { key: 'map', to: '/map', label: '地图', icon: Location }
  ];

  if (auth.isLoggedIn) items.push({ key: 'user', to: '/user', label: '个人中心', icon: User });
  else if (!settings.settings.hideLoginEntry) items.push({ key: 'login', to: '/login', label: '登录', icon: User });
  if (auth.isAdmin) items.push({ key: 'admin', to: '/admin', label: '管理后台', icon: Setting });
  return items;
});

const isActive = (item) => {
  if (item.key === 'home') return route.path === '/';
  if (item.key === 'user') return route.path.startsWith('/user');
  if (item.key === 'admin') return route.path.startsWith('/admin');
  return route.path === item.to || route.path.startsWith(`${item.to}/`);
};

const handleNavigate = async (event, item, navigate) => {
  if (item.key !== 'admin') {
    navigate(event);
    return;
  }

  event.preventDefault();
  const user = await auth.ensureSession(true);
  if (!user) {
    ElMessage.warning('请先登录');
    await router.push({ name: 'login', query: { redirect: item.to } });
    return;
  }
  if (!auth.isAdmin) {
    ElMessage.error('没有后台访问权限');
    await router.push({ name: 'forbidden' });
    return;
  }
  await router.push(item.to);
};
</script>

<style scoped>
.floating-dock {
  position: fixed;
  right: clamp(14px, 2vw, 32px);
  bottom: clamp(14px, 2vw, 32px);
  z-index: 1200;
  display: grid;
  grid-template-columns: repeat(2, 44px);
  gap: 10px;
}

.floating-dock a {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-dock-border);
  border-radius: 50%;
  color: var(--theme-dock-text);
  background: var(--theme-dock-bg);
  box-shadow: var(--theme-shadow);
  backdrop-filter: blur(16px);
  transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
}

.floating-dock a:hover,
.floating-dock a.active {
  color: var(--theme-dock-active-text);
  border-color: var(--theme-dock-active-bg);
  background: var(--theme-dock-active-bg);
  box-shadow: var(--theme-shadow);
  transform: translateY(-2px);
}

.dock-fade-enter-active,
.dock-fade-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.dock-fade-enter-from,
.dock-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 760px) {
  .floating-dock {
    grid-template-columns: repeat(2, 40px);
    gap: 8px;
  }

  .floating-dock a {
    width: 40px;
    height: 40px;
  }
}
</style>
