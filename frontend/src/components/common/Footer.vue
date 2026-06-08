<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <strong>{{ settings.siteName }}</strong>
        <p>{{ settings.homeIntro }}</p>
      </div>
      <div>
        <span>{{ settings.settings.footerCopyright }}</span>
        <span v-if="settings.settings.icp">{{ settings.settings.icp }}</span>
        <router-link to="/about">版权与联系</router-link>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useSettingsStore } from '../../stores/settings.store.js';

const settings = useSettingsStore();
</script>

<style scoped>
.site-footer {
  padding: 38px 0;
  border-top: 1px solid var(--theme-line);
  color: var(--theme-muted-strong);
  background: color-mix(in srgb, var(--theme-page-bg-bottom) 72%, var(--theme-surface));
}

.footer-grid {
  display: flex;
  justify-content: space-between;
  gap: 24px;
}

.footer-grid p {
  max-width: 560px;
  line-height: 1.8;
}

.footer-grid div:last-child {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: right;
}

@media (max-width: 760px) {
  .footer-grid {
    flex-direction: column;
  }

  .footer-grid div:last-child {
    text-align: left;
  }
}
</style>
