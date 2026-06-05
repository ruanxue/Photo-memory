<template>
  <div class="public-layout" :class="{ 'public-layout-home': isHome }">
    <main>
      <router-view />
    </main>
    <Footer v-if="!isHome" />
    <FloatingDock v-if="!isHome" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Footer from '../components/common/Footer.vue';
import FloatingDock from '../components/common/FloatingDock.vue';

const route = useRoute();
const isHome = computed(() => route.name === 'home');
</script>

<style scoped>
.public-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.public-layout main {
  flex: 1;
}

.public-layout-home main {
  flex: none;
}
</style>
