<template>
  <router-view />
  <transition name="rate-limit-panel">
    <div v-if="rateLimit.visible" class="rate-limit-layer" @click.self="hideRateLimit">
      <section class="rate-limit-card">
        <span class="rate-limit-mark">429</span>
        <p class="rate-limit-kicker">{{ settingsStore.siteName }}</p>
        <h2>访问有点太快了</h2>
        <p>{{ rateLimit.message }}</p>
        <small v-if="rateLimit.retryAfter">建议 {{ rateLimit.retryAfter }} 秒后再试。</small>
        <button type="button" @click="hideRateLimit">我知道了</button>
      </section>
    </div>
  </transition>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue';
import { useAuthStore } from './stores/auth.store.js';
import { useSettingsStore } from './stores/settings.store.js';

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const rateLimit = reactive({
  visible: false,
  message: '请求过于频繁，请稍后再试。',
  retryAfter: 0
});
let hideTimer = null;

const hideRateLimit = () => {
  rateLimit.visible = false;
  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = null;
};

const showRateLimit = (event) => {
  rateLimit.message = event.detail?.message || '请求过于频繁，请稍后再试。';
  rateLimit.retryAfter = Number(event.detail?.retryAfter || 0);
  rateLimit.visible = true;
  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hideRateLimit, 8000);
};

onMounted(() => {
  authStore.bootstrap();
  settingsStore.fetchPublicSettings();
  window.addEventListener('photo-memory:rate-limit', showRateLimit);
});

onBeforeUnmount(() => {
  window.removeEventListener('photo-memory:rate-limit', showRateLimit);
  if (hideTimer) window.clearTimeout(hideTimer);
});
</script>

<style scoped>
.rate-limit-layer {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 50% 18%, var(--theme-rate-limit-backdrop-a), transparent 34%),
    linear-gradient(180deg, var(--theme-rate-limit-backdrop-b), var(--theme-rate-limit-backdrop-c));
  backdrop-filter: blur(14px);
}

.rate-limit-card {
  position: relative;
  width: min(420px, 100%);
  overflow: hidden;
  padding: 28px;
  border: 1px solid var(--theme-line);
  border-radius: 10px;
  color: var(--theme-text);
  background: var(--theme-rate-limit-card-bg), var(--theme-surface);
  box-shadow: var(--theme-shadow);
}

.rate-limit-mark {
  position: absolute;
  top: -18px;
  right: 18px;
  color: var(--theme-rate-limit-mark);
  font-size: 92px;
  font-weight: 900;
  line-height: 1;
}

.rate-limit-kicker {
  margin: 0 0 12px;
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.rate-limit-card h2 {
  margin: 0 0 12px;
  font-size: 28px;
  line-height: 1.2;
}

.rate-limit-card p {
  margin: 0;
  color: var(--theme-muted-strong);
  line-height: 1.8;
}

.rate-limit-card small {
  display: block;
  margin-top: 12px;
  color: var(--theme-muted);
}

.rate-limit-card button {
  margin-top: 22px;
  padding: 10px 16px;
  border: 1px solid var(--theme-primary);
  border-radius: 999px;
  color: var(--theme-primary-text);
  background: var(--theme-primary);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.rate-limit-panel-enter-active,
.rate-limit-panel-leave-active {
  transition: opacity 0.24s ease;
}

.rate-limit-panel-enter-from,
.rate-limit-panel-leave-to {
  opacity: 0;
}

.rate-limit-panel-enter-active .rate-limit-card,
.rate-limit-panel-leave-active .rate-limit-card {
  transition: transform 0.28s ease, opacity 0.28s ease;
}

.rate-limit-panel-enter-from .rate-limit-card,
.rate-limit-panel-leave-to .rate-limit-card {
  opacity: 0;
  transform: translateY(14px) scale(0.98);
}
</style>
