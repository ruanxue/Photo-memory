<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">系统设置</h1>
        <p class="section-subtitle">维护站点名称、首页文案、访问开关、上传限制和浏览器图标。</p>
      </div>
      <el-button type="primary" @click="save">保存设置</el-button>
    </div>

    <el-form class="settings-form surface" :model="form" label-position="top">
      <el-form-item label="网站名称">
        <el-input v-model="form.siteName" />
      </el-form-item>
      <el-form-item label="网站副标题">
        <el-input v-model="form.siteSubtitle" />
      </el-form-item>
      <el-form-item label="首页介绍文字">
        <el-input v-model="form.homeIntro" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="Favicon 图片地址">
        <div class="favicon-row">
          <el-input v-model="form.faviconUrl" placeholder="支持 /favicon.svg、/uploads/xxx.png 或 https:// 图片地址" clearable />
          <span class="favicon-preview" :style="{ backgroundImage: `url(${form.faviconUrl || fallbackFavicon})` }" />
        </div>
      </el-form-item>

      <section class="settings-section">
        <div class="settings-section-head">
          <h2>首页主图</h2>
          <p>从公开照片中选择候选主图，并设置每次进入首页随机展示或固定展示其中一张。</p>
        </div>
        <div class="settings-grid">
          <el-form-item label="主图模式">
            <el-radio-group v-model="form.heroMode" @change="syncFixedHero">
              <el-radio-button label="random">随机主图</el-radio-button>
              <el-radio-button label="fixed">固定主图</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="form.heroMode === 'fixed'" label="固定照片">
            <el-select v-model="form.heroFixedPhotoId" :disabled="!selectedHeroPhotos.length" placeholder="请选择固定主图">
              <el-option v-for="photo in selectedHeroPhotos" :key="photo.id" :label="photo.title" :value="photo.id">
                <div class="photo-option compact">
                  <img :src="imageUrl(photo.thumbnailUrl || photo.mediumUrl)" :alt="photo.title" />
                  <span>{{ photo.title }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="候选照片">
          <el-select
            v-model="form.heroPhotoIds"
            class="hero-photo-select"
            multiple
            filterable
            remote
            reserve-keyword
            collapse-tags
            collapse-tags-tooltip
            :remote-method="loadHeroOptions"
            :loading="heroLoading"
            placeholder="搜索并选择公开照片"
            @visible-change="handleHeroSelectVisible"
          >
            <el-option v-for="photo in heroOptions" :key="photo.id" :label="photo.title" :value="photo.id">
              <div class="photo-option">
                <img :src="imageUrl(photo.thumbnailUrl || photo.mediumUrl)" :alt="photo.title" />
                <div>
                  <strong>{{ photo.title }}</strong>
                  <small>{{ photo.city || photo.locationName || '未知地点' }} · {{ formatDate(photo.takenAt || photo.uploadedAt) }}</small>
                </div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <div v-if="selectedHeroPhotos.length" class="hero-preview-grid">
          <article v-for="photo in selectedHeroPhotos" :key="photo.id" :class="{ active: photo.id === form.heroFixedPhotoId }">
            <img :src="imageUrl(photo.thumbnailUrl || photo.mediumUrl)" :alt="photo.title" />
            <span>{{ photo.title }}</span>
          </article>
        </div>
      </section>

      <div class="settings-grid">
        <el-form-item label="允许注册">
          <el-switch v-model="form.allowRegister" />
        </el-form-item>
        <el-form-item label="允许普通用户上传">
          <el-switch v-model="form.allowUserUpload" />
        </el-form-item>
        <el-form-item label="开放评论区">
          <el-switch v-model="form.commentsEnabled" />
        </el-form-item>
        <el-form-item label="评论审核">
          <el-switch v-model="form.commentReview" />
        </el-form-item>
        <el-form-item label="隐藏前台登录入口">
          <el-switch v-model="form.hideLoginEntry" />
        </el-form-item>
        <el-form-item label="水印开关">
          <el-switch v-model="form.watermarkEnabled" />
        </el-form-item>
        <el-form-item label="上传大小限制 MB">
          <el-input-number v-model="form.uploadMaxSizeMb" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="每页照片数量">
          <el-input-number v-model="form.pageSize" :min="6" :max="60" />
        </el-form-item>
        <el-form-item label="瀑布流列数">
          <el-select v-model="form.waterfallColumns">
            <el-option label="自动" value="auto" />
            <el-option label="2 列" value="2" />
            <el-option label="3 列" value="3" />
            <el-option label="4 列" value="4" />
            <el-option label="5 列" value="5" />
            <el-option label="6 列" value="6" />
            <el-option label="7 列" value="7" />
            <el-option label="8 列" value="8" />
          </el-select>
        </el-form-item>
        <el-form-item label="瀑布流混排相册">
          <el-switch v-model="form.includeAlbumsInWaterfall" />
        </el-form-item>
        <el-form-item label="悬停显示 EXIF">
          <el-switch v-model="form.showExifOnHover" />
        </el-form-item>
      </div>

      <section class="settings-section waterfall-section">
        <div class="settings-section-head">
          <h2>瀑布流显示</h2>
          <p>控制照片墙是否铺满屏幕，以及图片刚加载完成时的过渡动画。</p>
        </div>
        <div class="settings-grid">
          <el-form-item label="铺满左右空隙">
            <el-switch v-model="form.waterfallFullBleed" />
            <p class="field-help">开启后瀑布流会贴近屏幕两侧，只保留极小安全边距。</p>
          </el-form-item>
          <el-form-item label="图片加载动画">
            <el-select v-model="form.waterfallLoadAnimation">
              <el-option label="无动画" value="none" />
              <el-option label="模糊显现" value="blur" />
              <el-option label="自定义 CSS" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item label="动画时长 ms">
            <el-input-number v-model="form.waterfallLoadDurationMs" :min="200" :max="1600" :step="40" />
          </el-form-item>
          <el-form-item label="错峰延迟 ms">
            <el-input-number v-model="form.waterfallLoadStaggerMs" :min="0" :max="120" :step="4" />
          </el-form-item>
        </div>
        <el-form-item v-if="form.waterfallLoadAnimation === 'custom'" label="自定义加载 CSS">
          <el-input
            v-model="form.waterfallCustomLoadCss"
            type="textarea"
            :rows="4"
            maxlength="900"
            show-word-limit
            placeholder="例如：opacity: 0; filter: blur(24px) saturate(1.4); transform: scale(0.985); transition-timing-function: cubic-bezier(.2,.8,.2,1);"
          />
          <p class="field-help">只写 CSS 声明，不写选择器。允许 opacity / filter / transform / transition-timing-function，不会改变照片布局尺寸。</p>
        </el-form-item>
      </section>

      <section class="settings-section map-section">
        <div class="settings-section-head">
          <h2>地图底图</h2>
          <p>国内网络访问 OpenStreetMap 可能较慢或失败，可切换为高德瓦片，或填写自己的 HTTPS 瓦片服务。</p>
        </div>
        <div class="settings-grid">
          <el-form-item label="底图来源">
            <el-select v-model="form.mapTileProvider">
              <el-option label="高德地图（国内推荐）" value="amap" />
              <el-option label="OpenStreetMap" value="osm" />
              <el-option label="自定义瓦片 URL" value="custom" />
            </el-select>
            <p class="field-help">自定义 URL 支持 {s}、{z}、{x}、{y} 占位符，必须使用 HTTPS。</p>
          </el-form-item>
          <el-form-item label="版权署名">
            <el-input v-model="form.mapTileAttribution" placeholder="例如：© 高德地图" />
          </el-form-item>
        </div>
        <el-form-item v-if="form.mapTileProvider === 'custom'" label="自定义瓦片 URL">
          <el-input
            v-model="form.mapTileUrl"
            placeholder="例如：https://your-tile.example.com/{z}/{x}/{y}.png"
            clearable
          />
          <p class="field-help">不要填写需要前端暴露密钥的服务；如必须使用密钥，建议在反向代理或后端做转发。</p>
        </el-form-item>
      </section>

      <section class="settings-section deploy-section">
        <div class="settings-section-head">
          <h2>部署与代理</h2>
          <p>站点部署在 Nginx、Caddy、CDN 等反向代理后时，用它告诉后端应信任几层代理头，以便评论审计记录真实访客 IP。</p>
        </div>
        <div class="settings-grid">
          <el-form-item label="TRUST_PROXY_HOPS">
            <el-input-number v-model="form.trustProxyHops" :min="0" :max="10" />
            <p class="field-help">本机直连填 0；只有一层 Nginx/Caddy 反代填 1；CDN + 反代通常填 2。</p>
          </el-form-item>
        </div>
        <el-alert
          title="保存后会立即影响新的请求，并会保存到数据库；backend/.env 中的 TRUST_PROXY_HOPS 作为首次部署或数据库不可用时的兜底。"
          type="warning"
          :closable="false"
          show-icon
        />
      </section>

      <el-form-item label="默认排序">
        <el-select v-model="form.defaultSort">
          <el-option label="最新上传" value="latest" />
          <el-option label="拍摄时间" value="taken" />
          <el-option label="浏览量" value="views" />
        </el-select>
      </el-form-item>
      <el-form-item label="ICP 备案号">
        <el-input v-model="form.icp" />
      </el-form-item>
      <el-form-item label="页脚版权">
        <el-input v-model="form.footerCopyright" />
      </el-form-item>
      <el-form-item label="瀑布流技术署名">
        <el-input v-model="form.technologyCredit" placeholder="例如：Vue 3 & Express + Prisma + SQLite" />
      </el-form-item>
    </el-form>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { imageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';

const settingsStore = useSettingsStore();
const fallbackFavicon =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2308090a%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2218%22 fill=%22none%22 stroke=%22%238fb8c4%22 stroke-width=%226%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%227%22 fill=%22%23d89575%22/%3E%3C/svg%3E';

const form = reactive({
  siteName: 'Photo Memory',
  siteSubtitle: '私人影像馆',
  homeIntro: '',
  faviconUrl: '',
  heroMode: 'random',
  heroPhotoIds: [],
  heroFixedPhotoId: null,
  allowRegister: true,
  allowUserUpload: true,
  commentsEnabled: true,
  commentReview: false,
  hideLoginEntry: false,
  watermarkEnabled: false,
  uploadMaxSizeMb: 15,
  pageSize: 20,
  waterfallColumns: 'auto',
  waterfallFullBleed: false,
  waterfallLoadAnimation: 'blur',
  waterfallLoadDurationMs: 720,
  waterfallLoadStaggerMs: 24,
  waterfallCustomLoadCss: '',
  trustProxyHops: 0,
  includeAlbumsInWaterfall: true,
  showExifOnHover: true,
  mapTileProvider: 'amap',
  mapTileUrl: '',
  mapTileAttribution: '© 高德地图',
  defaultSort: 'latest',
  icp: '',
  footerCopyright: '© Photo Memory',
  technologyCredit: 'Vue 3 & Express + Prisma + SQLite'
});

const boolKeys = [
  'allowRegister',
  'allowUserUpload',
  'commentsEnabled',
  'commentReview',
  'hideLoginEntry',
  'watermarkEnabled',
  'includeAlbumsInWaterfall',
  'showExifOnHover',
  'waterfallFullBleed'
];

const heroLoading = ref(false);
const heroOptions = ref([]);

const normalizeIds = (value) => {
  if (Array.isArray(value)) return [...new Set(value.map(Number).filter((item) => Number.isInteger(item) && item > 0))];
  try {
    const parsed = JSON.parse(value || '[]');
    if (Array.isArray(parsed)) return normalizeIds(parsed);
  } catch {
    // fall through to comma separated parsing
  }
  return [...new Set(String(value || '').split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0))];
};

const numberOrNull = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeLoadAnimation = (value) => ['none', 'blur', 'custom'].includes(value) ? value : 'blur';
const normalizeMapProvider = (value) => ['amap', 'osm', 'custom'].includes(value) ? value : 'amap';
const normalizeMapTileUrl = (value) => {
  const url = String(value || '').trim();
  if (!url) return '';
  return /^https:\/\/[^<>"'\s]+$/i.test(url) ? url.slice(0, 500) : '';
};

const mergeHeroOptions = (photos = []) => {
  const map = new Map(heroOptions.value.map((photo) => [photo.id, photo]));
  photos.forEach((photo) => map.set(photo.id, photo));
  heroOptions.value = [...map.values()];
};

const selectedHeroPhotos = computed(() => {
  const map = new Map(heroOptions.value.map((photo) => [photo.id, photo]));
  return form.heroPhotoIds.map((id) => map.get(id)).filter(Boolean);
});

const ensureSelectedHeroOptions = async () => {
  const missing = form.heroPhotoIds.filter((id) => !heroOptions.value.some((photo) => photo.id === id));
  if (!missing.length) return;
  const res = await adminApi.photos({ ids: missing.join(','), visibility: 'public', status: 'normal', pageSize: missing.length });
  mergeHeroOptions(res.data || []);
};

const loadHeroOptions = async (query = '') => {
  heroLoading.value = true;
  try {
    const res = await adminApi.photos({ q: query, visibility: 'public', status: 'normal', pageSize: 60 });
    mergeHeroOptions(res.data || []);
    await ensureSelectedHeroOptions();
  } finally {
    heroLoading.value = false;
  }
};

const handleHeroSelectVisible = (visible) => {
  if (visible && !heroOptions.value.length) loadHeroOptions();
};

const syncFixedHero = () => {
  if (!form.heroPhotoIds.includes(form.heroFixedPhotoId)) {
    form.heroFixedPhotoId = form.heroPhotoIds[0] || null;
  }
};

onMounted(async () => {
  const res = await adminApi.settings();
  res.data.forEach((item) => {
    if (boolKeys.includes(item.key)) form[item.key] = item.value === 'true';
    else if (['uploadMaxSizeMb', 'pageSize', 'trustProxyHops', 'waterfallLoadDurationMs', 'waterfallLoadStaggerMs'].includes(item.key)) form[item.key] = Number(item.value);
    else if (item.key === 'heroPhotoIds') form.heroPhotoIds = normalizeIds(item.value);
    else if (item.key === 'heroFixedPhotoId') form.heroFixedPhotoId = numberOrNull(item.value);
    else if (item.key === 'heroMode') form.heroMode = item.value === 'fixed' ? 'fixed' : 'random';
    else if (item.key === 'waterfallLoadAnimation') form.waterfallLoadAnimation = normalizeLoadAnimation(item.value);
    else if (item.key === 'mapTileProvider') form.mapTileProvider = normalizeMapProvider(item.value);
    else if (Object.prototype.hasOwnProperty.call(form, item.key)) form[item.key] = item.value;
  });
  await loadHeroOptions();
  syncFixedHero();
});

const save = async () => {
  form.heroPhotoIds = normalizeIds(form.heroPhotoIds);
  syncFixedHero();
  const payload = Object.entries(form).map(([key, value]) => {
    if (key === 'heroPhotoIds') return { key, value: JSON.stringify(normalizeIds(value)) };
    if (key === 'heroFixedPhotoId') return { key, value: value ? String(value) : '' };
    if (key === 'heroMode') return { key, value: value === 'fixed' ? 'fixed' : 'random' };
    if (key === 'trustProxyHops') return { key, value: String(Math.max(0, Math.min(10, Number(value) || 0))) };
    if (key === 'waterfallLoadAnimation') return { key, value: normalizeLoadAnimation(value) };
    if (key === 'waterfallLoadDurationMs') return { key, value: String(Math.max(200, Math.min(1600, Number(value) || 720))) };
    if (key === 'waterfallLoadStaggerMs') return { key, value: String(Math.max(0, Math.min(120, Number(value) || 24))) };
    if (key === 'mapTileProvider') return { key, value: normalizeMapProvider(value) };
    if (key === 'mapTileUrl') return { key, value: normalizeMapTileUrl(value) };
    if (key === 'mapTileAttribution') return { key, value: String(value || '').replace(/[<>]/g, '').slice(0, 120) };
    return { key, value: String(value) };
  });
  await adminApi.updateSettings(payload);
  await settingsStore.fetchPublicSettings();
  ElMessage.success('设置已保存');
};

watch(() => form.heroPhotoIds.slice(), async () => {
  await ensureSelectedHeroOptions();
  syncFixedHero();
});
</script>

<style scoped>
.settings-form {
  max-width: 880px;
  padding: 22px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.settings-section {
  display: grid;
  gap: 14px;
  padding: 18px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.deploy-section,
.map-section,
.waterfall-section {
  margin-top: 4px;
}

.settings-section-head h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.settings-section-head p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.7;
}

.field-help {
  width: 100%;
  margin: 8px 0 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.6;
}

.hero-photo-select {
  width: 100%;
}

.photo-option {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.photo-option img {
  width: 46px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 4px;
  object-fit: cover;
}

.photo-option div {
  min-width: 0;
  display: grid;
}

.photo-option strong,
.photo-option span {
  overflow: hidden;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-option small {
  overflow: hidden;
  color: var(--muted-strong);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-option.compact img {
  width: 38px;
  height: 28px;
}

.hero-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.hero-preview-grid article {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}

.hero-preview-grid article.active {
  border-color: color-mix(in srgb, var(--primary) 72%, #ffffff);
}

.hero-preview-grid img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}

.hero-preview-grid span {
  display: block;
  overflow: hidden;
  padding: 8px;
  color: var(--muted-strong);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favicon-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  gap: 12px;
  align-items: center;
}

.favicon-preview {
  width: 42px;
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.06);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}
</style>
