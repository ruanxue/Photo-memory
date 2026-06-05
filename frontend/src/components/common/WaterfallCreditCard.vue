<template>
  <aside class="wall-credit" aria-label="版权与技术信息">
    <span class="credit-label">{{ settings.siteName }}</span>
    <strong>{{ settings.settings.footerCopyright }}</strong>
    <span v-if="settings.settings.icp" class="credit-meta">{{ settings.settings.icp }}</span>
    <span class="credit-tech">{{ settings.settings.technologyCredit }}</span>
  </aside>
</template>

<script setup>
import { useSettingsStore } from '../../stores/settings.store.js';

const settings = useSettingsStore();
</script>

<style scoped>
.wall-credit {
  min-height: clamp(134px, 15vw, 186px);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 9px;
  padding: clamp(16px, 1.5vw, 22px);
  border: 1px solid rgba(143, 184, 196, 0.18);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  background: #090c0e;
}

.credit-label {
  color: var(--primary);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  line-height: 1.55;
}

.credit-meta {
  color: rgba(255, 255, 255, 0.56);
  font-size: 12px;
  line-height: 1.5;
}

.credit-tech {
  margin-top: 5px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  color: rgba(210, 238, 244, 0.76);
  font-size: 12px;
  line-height: 1.6;
}
</style>
