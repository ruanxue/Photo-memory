<template>
  <button
    class="visibility-toggle"
    :class="value === 'private' ? 'is-private' : 'is-public'"
    type="button"
    :disabled="loading"
    :title="value === 'private' ? '点击设为公开' : '点击设为私密'"
    @click="emit('toggle', nextValue)"
  >
    <span class="dot" />
    <span>{{ value === 'private' ? '私密' : '公开' }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: { type: String, default: 'public' },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['toggle']);

const nextValue = computed(() => (props.value === 'private' ? 'public' : 'private'));
</script>

<style scoped>
.visibility-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 66px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--theme-button-border);
  border-radius: 999px;
  color: var(--theme-button-text);
  background: var(--theme-button-bg);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.visibility-toggle:hover,
.visibility-toggle:focus-visible {
  color: var(--theme-button-hover-text);
  background: var(--theme-button-hover-bg);
  border-color: var(--theme-button-hover-border);
  outline: none;
}

.visibility-toggle:disabled {
  cursor: wait;
  opacity: 0.62;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.is-public {
  color: var(--theme-primary-strong);
  border-color: color-mix(in srgb, var(--theme-primary) 34%, var(--theme-button-border));
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--theme-button-bg));
}

.is-private {
  color: var(--theme-muted-strong);
  border-color: var(--theme-line);
  background: var(--theme-surface-soft);
}
</style>
