<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth.store.js';
import { useSettingsStore } from './stores/settings.store.js';

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  authStore.bootstrap();
  settingsStore.fetchPublicSettings();
});
</script>
