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
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--muted-strong);
  background: var(--surface-glass);
}

.credit-label {
  color: var(--primary);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

strong {
  color: var(--text);
  font-size: 14px;
  line-height: 1.55;
}

.credit-meta {
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.5;
}

.credit-tech {
  margin-top: 5px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
  color: var(--primary-strong);
  font-size: 12px;
  line-height: 1.6;
}
</style>
