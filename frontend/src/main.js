import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'leaflet/dist/leaflet.css';
import App from './App.vue';
import router from './router/index.js';
import './assets/styles/variables.css';
import './assets/styles/theme-contract.css';
import './assets/styles/main.css';

document.documentElement.classList.add('light');

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.mount('#app');
