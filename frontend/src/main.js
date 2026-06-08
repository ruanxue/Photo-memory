import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
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
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');
