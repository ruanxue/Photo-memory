<template>
  <aside class="wall-credit" aria-label="版权与技术信息">
    <span v-if="siteName" class="credit-label">{{ siteName }}</span>
    <strong v-if="copyright">{{ copyright }}</strong>
    <span v-if="icp" class="credit-meta">{{ icp }}</span>
    <span v-if="technologyCredit" class="credit-tech">{{ technologyCredit }}</span>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/settings.store.js';

const settings = useSettingsStore();

const textValue = (value) => String(value || '').trim();
const siteName = computed(() => textValue(settings.siteName));
const copyright = computed(() => textValue(settings.settings.footerCopyright));
const icp = computed(() => textValue(settings.settings.icp));
const technologyCredit = computed(() => textValue(settings.settings.technologyCredit));
</script>

<style scoped>
.wall-credit {
  min-height: 0;
  height: fit-content;
  display: grid;
  gap: clamp(5px, 0.55vw, 8px);
  align-self: start;
  padding: clamp(12px, 1vw, 16px);
  border: 1px solid var(--theme-line);
  border-radius: 4px;
  color: var(--theme-muted-strong);
  background: var(--theme-surface-glass);
}

.credit-label {
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

strong {
  color: var(--theme-text);
  font-size: clamp(13px, 0.98vw, 14px);
  line-height: 1.35;
}

.credit-meta {
  color: var(--theme-muted-strong);
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.credit-tech {
  margin-top: 3px;
  padding-top: 8px;
  border-top: 1px solid var(--theme-line-soft);
  color: var(--theme-primary-strong);
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
</style>
