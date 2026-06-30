<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">系统设置</h1>
      </div>
      <el-button type="primary" @click="save">保存设置</el-button>
    </div>

    <el-form class="settings-form surface" :model="form" label-position="top">
      <el-form-item label="网站名称">
        <el-input v-model="form.siteName" />
      </el-form-item>
      <el-form-item label="网站副标题">
        <el-input v-model="form.siteSubtitle" clearable placeholder="可留空，例如：在风里，替时间收信。" />
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

      <section class="settings-section theme-section">
        <div class="settings-section-head">
          <h2>主题外观</h2>
          <p>选择站点整体配色。启用自定义主题后，自定义主题会覆盖全站色彩，亮色 / 暗色 / 自动只作为关闭自定义后的备用预设。</p>
        </div>
        <el-form-item label="主题模式">
          <el-radio-group v-model="form.themeMode" :disabled="form.themeCustomEnabled">
            <el-radio-button value="light">亮色</el-radio-button>
            <el-radio-button value="dark">暗色</el-radio-button>
            <el-radio-button value="auto">自动</el-radio-button>
          </el-radio-group>
          <p v-if="form.themeCustomEnabled" class="field-help">当前已启用自定义主题，预设主题模式暂不参与页面配色。</p>
        </el-form-item>
        <el-collapse v-model="themeEditorPanels" class="theme-custom-collapse">
          <el-collapse-item name="custom-theme">
            <template #title>
              <div class="theme-collapse-title">
                <strong>自定义主题</strong>
                <span>{{ form.themeCustomEnabled ? `${form.themeCustomName || '未命名主题'} · ${form.themeCustomEditorMode === 'simple' ? '简单模式' : '高级模式'}` : '未启用，点击展开配置' }}</span>
              </div>
            </template>
            <div class="theme-custom-editor">
              <div class="theme-custom-toolbar">
            <el-form-item label="启用自定义主题">
              <el-switch v-model="form.themeCustomEnabled" />
            </el-form-item>
            <el-form-item label="主题名称">
              <el-input v-model="form.themeCustomName" maxlength="32" placeholder="例如：暖白摄影主题" />
            </el-form-item>
            <el-form-item label="编辑模式">
              <el-radio-group v-model="form.themeCustomEditorMode">
                <el-radio-button value="simple">简单</el-radio-button>
                <el-radio-button value="advanced">高级</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="已保存方案">
              <div class="saved-theme-row">
                <el-select v-model="savedThemeId" placeholder="选择已保存主题" clearable>
                  <el-option v-for="theme in form.savedThemes" :key="theme.id" :label="theme.name" :value="theme.id" />
                </el-select>
                <el-button @click="applySavedTheme" :disabled="!savedThemeId">应用</el-button>
                <el-button @click="removeSavedTheme" :disabled="!savedThemeId">删除</el-button>
              </div>
            </el-form-item>
          </div>
          <div class="theme-editor-actions">
            <el-button @click="resetCustomThemeColors">恢复推荐色</el-button>
            <el-button type="primary" @click="saveCurrentThemePreset">保存当前配色为方案</el-button>
            <el-button @click="exportCurrentTheme">导出当前方案</el-button>
            <el-button @click="triggerThemeImport">导入方案</el-button>
            <input
              ref="themeImportInput"
              class="theme-import-input"
              type="file"
              accept="application/json,.json"
              @change="importThemeFile"
            />
          </div>
          <p class="field-help theme-mode-help">
            {{ form.themeCustomEditorMode === 'simple'
              ? '简单模式会把相近页面场景合并控制，适合快速调出统一风格。'
              : '高级模式可精细调整每类组件颜色，适合已经确定完整视觉方案时使用。' }}
          </p>
          <div class="theme-color-grid" :class="{ simple: form.themeCustomEditorMode === 'simple' }">
            <label v-for="field in displayedColorFields" :key="field.key" class="theme-color-field">
              <span>
                <strong>{{ field.label }}</strong>
                <small>{{ field.description }}</small>
              </span>
              <div class="color-input-row">
                <el-color-picker
                  v-model="form.themeCustomColors[field.key]"
                  :predefine="colorPredefines"
                  @change="updateThemeColorField(field, form.themeCustomColors[field.key])"
                />
                <el-input
                  v-model="form.themeCustomColors[field.key]"
                  maxlength="7"
                  @blur="updateThemeColorField(field, form.themeCustomColors[field.key])"
                />
              </div>
            </label>
          </div>
          <div class="theme-preview-board" :style="{ background: form.themeCustomColors.pageBg, color: form.themeCustomColors.text, borderColor: form.themeCustomColors.line }">
            <article class="theme-preview-panel" :style="{ background: form.themeCustomColors.surface, borderColor: form.themeCustomColors.line }">
              <div class="preview-head">
                <strong :style="{ color: form.themeCustomColors.text }">页面与卡片</strong>
                <span :style="{ color: form.themeCustomColors.muted }">背景、正文、辅助文字、边框</span>
              </div>
              <p :style="{ color: form.themeCustomColors.text }">Photo Memory</p>
              <small :style="{ color: form.themeCustomColors.muted }">2026/06/07 · 128 浏览</small>
              <div class="preview-soft" :style="{ background: form.themeCustomColors.surfaceSoft, borderColor: form.themeCustomColors.line, color: form.themeCustomColors.textSoft }">
                柔和面板 / 侧栏 / 次级区域
              </div>
            </article>

            <article class="theme-preview-panel" :style="{ background: form.themeCustomColors.surface, borderColor: form.themeCustomColors.line }">
              <div class="preview-head">
                <strong :style="{ color: form.themeCustomColors.text }">按钮与控件</strong>
                <span :style="{ color: form.themeCustomColors.muted }">主按钮、普通按钮、悬停状态</span>
              </div>
              <div class="preview-controls">
                <button :style="{ background: form.themeCustomColors.primary, color: readableOn(form.themeCustomColors.primary), borderColor: form.themeCustomColors.primary }">保存</button>
                <button :style="{ background: form.themeCustomColors.buttonBg, color: form.themeCustomColors.buttonText, borderColor: form.themeCustomColors.line }">取消</button>
                <button :style="{ background: form.themeCustomColors.buttonHoverBg, color: form.themeCustomColors.buttonText, borderColor: form.themeCustomColors.primary }">悬停</button>
              </div>
            </article>

            <article class="theme-preview-panel" :style="{ background: form.themeCustomColors.surface, borderColor: form.themeCustomColors.line }">
              <div class="preview-head">
                <strong :style="{ color: form.themeCustomColors.text }">标签与导航</strong>
                <span :style="{ color: form.themeCustomColors.muted }">标签、强调色、右下角导航选中态</span>
              </div>
              <div class="preview-chip-row">
                <span class="preview-tag" :style="{ background: form.themeCustomColors.tagBg, color: form.themeCustomColors.tagText, borderColor: form.themeCustomColors.line }">#旅行</span>
                <span class="preview-tag" :style="{ background: form.themeCustomColors.tagBg, color: form.themeCustomColors.tagText, borderColor: form.themeCustomColors.line }">#街头</span>
                <span class="preview-dot" :style="{ background: form.themeCustomColors.accent }" />
                <span class="preview-dock" :style="{ background: form.themeCustomColors.dockActiveBg, color: form.themeCustomColors.dockActiveText }">⌂</span>
              </div>
            </article>

            <article class="theme-preview-panel photo-preview-panel" :style="{ borderColor: form.themeCustomColors.line }">
              <div class="preview-photo-image">
                <div class="preview-photo-overlay" :style="{ background: form.themeCustomColors.imageOverlayBg, color: form.themeCustomColors.imageOverlayText, borderColor: form.themeCustomColors.imageOverlayText }">
                  <strong>Exif</strong>
                  <span>ISO 400 · f/2.8 · 35mm</span>
                </div>
                <span class="preview-photo-tag" :style="{ background: form.themeCustomColors.imageOverlayBg, color: form.themeCustomColors.imageOverlayText, borderColor: form.themeCustomColors.imageOverlayText }">精选</span>
              </div>
            </article>

            <article class="theme-preview-panel map-preview-panel" :style="{ background: form.themeCustomColors.surface, borderColor: form.themeCustomColors.line }">
              <div class="preview-head">
                <strong :style="{ color: form.themeCustomColors.text }">地图弹窗</strong>
                <span :style="{ color: form.themeCustomColors.muted }">地图控件、弹窗和点位</span>
              </div>
              <div class="preview-map-box">
                <div class="preview-map-controls">
                  <button :style="{ background: form.themeCustomColors.mapControlBg, color: form.themeCustomColors.mapControlText, borderColor: form.themeCustomColors.line }">+</button>
                  <button :style="{ background: form.themeCustomColors.mapControlBg, color: form.themeCustomColors.mapControlText, borderColor: form.themeCustomColors.line }">−</button>
                </div>
                <span class="preview-marker" :style="{ background: form.themeCustomColors.accent }" />
                <div class="preview-map-popup" :style="{ background: form.themeCustomColors.mapPopupBg, color: form.themeCustomColors.mapPopupText, borderColor: form.themeCustomColors.line }">
                  <strong>上海街角</strong>
                  <span :style="{ color: form.themeCustomColors.muted }">上海 · 2026/06/07</span>
                </div>
              </div>
            </article>
          </div>
          <div class="contrast-grid">
            <article v-for="check in contrastChecks" :key="check.label" :class="['contrast-card', check.level]">
              <div>
                <strong>{{ check.label }}</strong>
                <span>{{ check.ratio.toFixed(2) }} : 1</span>
              </div>
              <p>{{ check.message }}</p>
              <el-button v-if="check.level !== 'pass'" size="small" @click="applyContrastSuggestion(check)">
                采用建议色 {{ check.suggestion }}
              </el-button>
            </article>
          </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </section>

      <section class="settings-section">
        <div class="settings-section-head">
          <h2>首页主图</h2>
          <p>从公开照片中选择候选主图，并设置每次进入首页随机展示或固定展示其中一张。</p>
        </div>
        <div class="settings-grid">
          <el-form-item label="主图模式">
            <el-radio-group v-model="form.heroMode" @change="syncFixedHero">
              <el-radio-button value="random">随机主图</el-radio-button>
              <el-radio-button value="fixed">固定主图</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="form.heroMode === 'fixed'" label="固定照片">
            <el-select v-model="form.heroFixedPhotoId" :disabled="!selectedHeroPhotos.length" placeholder="请选择固定主图">
              <el-option v-for="photo in selectedHeroPhotos" :key="photo.id" :label="photo.title" :value="photo.id">
                <div class="photo-option compact">
                  <img :src="photoImageUrl(photo)" :alt="photo.title" @error="handleImageError" />
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
                <img :src="photoImageUrl(photo)" :alt="photo.title" @error="handleImageError" />
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
            <img :src="photoImageUrl(photo)" :alt="photo.title" @error="handleImageError" />
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
          <el-form-item label="卡片圆角 px">
            <el-input-number v-model="form.waterfallCardRadius" :min="0" :max="24" :step="1" />
            <p class="field-help">同时影响照片卡片、相册卡片以及卡片内图片的圆角。</p>
          </el-form-item>
          <el-form-item label="滚动入场动画">
            <el-select v-model="form.waterfallRevealAnimation">
              <el-option label="上移归位" value="slide-up" />
              <el-option label="从无到有" value="fade" />
              <el-option label="关闭" value="none" />
            </el-select>
            <p class="field-help">控制滚动时底部新卡片进入视口的方式。</p>
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
              <el-option label="百度地图 JSAPI GL" value="baidu" />
              <el-option label="OpenStreetMap" value="osm" />
              <el-option label="自定义瓦片 URL" value="custom" />
            </el-select>
            <p class="field-help">百度地图使用 JSAPI GL，需要填写 Web 端 AK；自定义 URL 支持 {s}、{z}、{x}、{y} 占位符，必须使用 HTTPS。</p>
          </el-form-item>
          <el-form-item label="版权署名">
            <el-input v-model="form.mapTileAttribution" placeholder="例如：© 高德地图" />
          </el-form-item>
        </div>
        <div v-if="form.mapTileProvider === 'baidu'" class="settings-grid">
          <el-form-item label="百度地图 Web 端 AK">
            <el-input v-model="form.baiduMapWebAk" placeholder="用于浏览器加载 JSAPI GL" clearable />
            <p class="field-help">Web 端 AK 会下发到浏览器，请在百度控制台配置正确的 Referer 白名单。</p>
          </el-form-item>
          <el-form-item label="百度地图服务端 AK">
            <el-input v-model="form.baiduMapServerAk" type="password" show-password placeholder="预留给后续服务端检索/坐标转换" clearable />
            <p class="field-help">服务端 AK 只在后台保存，不会出现在公开设置接口里。</p>
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
        <div class="map-zoom-panel">
          <div class="settings-section-head compact">
            <h3>地图视角高度</h3>
            <p>数值越小，视角越高、显示范围越大。高德地图境外信息较少时，建议把境外视角设为 6-8。</p>
          </div>
          <div class="settings-grid">
            <el-form-item label="地图页 · 中国">
              <el-input-number v-model="form.mapPageZoomChina" :min="3" :max="14" />
            </el-form-item>
            <el-form-item label="地图页 · 境外">
              <el-input-number v-model="form.mapPageZoomOverseas" :min="3" :max="14" />
            </el-form-item>
            <el-form-item label="详情页 · 中国">
              <el-input-number v-model="form.mapDetailZoomChina" :min="3" :max="14" />
            </el-form-item>
            <el-form-item label="详情页 · 境外">
              <el-input-number v-model="form.mapDetailZoomOverseas" :min="3" :max="14" />
            </el-form-item>
          </div>
          <div class="map-zoom-preview">
            <article v-for="item in mapZoomPreviewItems" :key="item.key">
              <div class="map-zoom-card-head">
                <span>{{ item.label }}</span>
                <strong>Zoom {{ item.value }}</strong>
              </div>
              <div class="map-zoom-visual">
                <i :style="{ width: mapZoomPreviewSize(item.value), height: mapZoomPreviewSize(item.value) }" />
              </div>
              <el-input-number
                v-model="form[item.key]"
                class="map-zoom-stepper"
                :min="3"
                :max="14"
                :step="1"
              />
              <small>{{ mapZoomPreviewText(item.value) }}</small>
            </article>
          </div>
        </div>
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
          class="theme-inline-alert"
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
import { ElMessage } from 'element-plus/es/components/message/index';
import { adminApi } from '../../api/admin.api.js';
import { defaultCustomThemeColors, useSettingsStore } from '../../stores/settings.store.js';
import { handleImageError, photoImageUrl } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';

const settingsStore = useSettingsStore();
const fallbackFavicon =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2308090a%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2218%22 fill=%22none%22 stroke=%22%238fb8c4%22 stroke-width=%226%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%227%22 fill=%22%23d89575%22/%3E%3C/svg%3E';

const form = reactive({
  siteName: '风经过的地方',
  siteSubtitle: '',
  homeIntro: '把走过的路、爱过的人，和那些不肯散场的光，慢慢收起来。',
  faviconUrl: '',
  themeMode: 'light',
  themeCustomEnabled: false,
  themeCustomName: '',
  themeCustomEditorMode: 'simple',
  themeCustomColors: { ...defaultCustomThemeColors },
  savedThemes: [],
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
  waterfallCardRadius: 4,
  waterfallRevealAnimation: 'slide-up',
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
  baiduMapWebAk: '',
  baiduMapServerAk: '',
  mapPageZoomChina: 12,
  mapPageZoomOverseas: 7,
  mapDetailZoomChina: 11,
  mapDetailZoomOverseas: 7,
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
  'waterfallFullBleed',
  'themeCustomEnabled'
];

const themeEditorPanels = ref([]);
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
const normalizeRevealAnimation = (value) => ['slide-up', 'fade', 'none'].includes(value) ? value : 'slide-up';
const normalizeMapProvider = (value) => ['amap', 'osm', 'custom', 'baidu'].includes(value) ? value : 'amap';
const normalizeThemeMode = (value) => ['light', 'dark', 'auto'].includes(value) ? value : 'light';
const normalizeThemeEditorMode = (value) => ['simple', 'advanced'].includes(value) ? value : 'simple';
const mapZoomKeys = ['mapPageZoomChina', 'mapPageZoomOverseas', 'mapDetailZoomChina', 'mapDetailZoomOverseas'];
const mapZoomFallbacks = {
  mapPageZoomChina: 12,
  mapPageZoomOverseas: 7,
  mapDetailZoomChina: 11,
  mapDetailZoomOverseas: 7
};
const normalizeMapZoom = (key, value) => {
  const zoom = Number(value);
  return Math.max(3, Math.min(14, Number.isFinite(zoom) ? Math.round(zoom) : mapZoomFallbacks[key]));
};
const normalizeHexColor = (value, fallback = '#000000') => {
  const color = String(value || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
};
const normalizeMapTileUrl = (value) => {
  const url = String(value || '').trim();
  if (!url) return '';
  return /^https:\/\/[^<>"'\s]+$/i.test(url) ? url.slice(0, 500) : '';
};
const normalizeBaiduAk = (value) => String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 120);
const mapZoomPreviewItems = computed(() => [
  { key: 'mapPageZoomChina', label: '地图页 · 中国', value: normalizeMapZoom('mapPageZoomChina', form.mapPageZoomChina) },
  { key: 'mapPageZoomOverseas', label: '地图页 · 境外', value: normalizeMapZoom('mapPageZoomOverseas', form.mapPageZoomOverseas) },
  { key: 'mapDetailZoomChina', label: '详情页 · 中国', value: normalizeMapZoom('mapDetailZoomChina', form.mapDetailZoomChina) },
  { key: 'mapDetailZoomOverseas', label: '详情页 · 境外', value: normalizeMapZoom('mapDetailZoomOverseas', form.mapDetailZoomOverseas) }
]);
const mapZoomPreviewSize = (zoom) => `${Math.max(24, Math.min(86, 22 + (14 - Number(zoom)) * 6))}%`;
const mapZoomPreviewText = (zoom) => {
  if (Number(zoom) <= 7) return '高视角，适合境外区域';
  if (Number(zoom) <= 10) return '中等视角，适合城市群';
  return '近景视角，适合国内城市';
};

const colorFields = [
  { key: 'primary', label: '主色', description: '主要按钮、选中态、强调操作' },
  { key: 'accent', label: '强调色', description: '地图点位、局部强调' },
  { key: 'pageBg', label: '页面背景', description: '全站页面底色' },
  { key: 'surface', label: '卡片背景', description: '卡片、弹层主体背景' },
  { key: 'surfaceSoft', label: '柔和背景', description: '侧栏、次级面板背景' },
  { key: 'surfaceOverlay', label: '浮层背景', description: '弹窗、下拉菜单背景' },
  { key: 'text', label: '正文文字', description: '主要文本颜色' },
  { key: 'textSoft', label: '次级文字', description: '说明、表格次级文本' },
  { key: 'muted', label: '弱化文字', description: '日期、统计等弱信息' },
  { key: 'line', label: '边框线', description: '卡片、表格和分割线' },
  { key: 'buttonBg', label: '按钮背景', description: '普通按钮底色' },
  { key: 'buttonText', label: '按钮文字', description: '普通按钮文字' },
  { key: 'buttonHoverBg', label: '按钮悬停', description: '普通按钮悬停背景' },
  { key: 'tagBg', label: '标签背景', description: '标签、标签云底色' },
  { key: 'tagText', label: '标签文字', description: '标签文字颜色' },
  { key: 'mapControlBg', label: '地图控件背景', description: '缩放按钮和控件背景' },
  { key: 'mapControlText', label: '地图控件文字', description: '地图按钮和控件文字' },
  { key: 'mapPopupBg', label: '地图弹窗背景', description: '地图照片悬浮弹窗背景' },
  { key: 'mapPopupText', label: '地图弹窗文字', description: '地图照片悬浮弹窗文字' },
  { key: 'dockActiveBg', label: '导航选中背景', description: '右下角圆形导航选中态' },
  { key: 'dockActiveText', label: '导航选中文字', description: '右下角圆形导航图标文字' },
  { key: 'imageOverlayBg', label: '照片悬浮背景', description: '照片卡片内悬浮信息底色' },
  { key: 'imageOverlayText', label: '照片悬浮文字', description: '照片卡片内悬浮信息文字' }
];
const savedThemeId = ref('');
const themeImportInput = ref(null);
const colorPredefines = ['#172026', '#ffffff', '#f6f1e9', '#fffaf3', '#3f3328', '#8d7155', '#b66f54', '#8fb8c4', '#071012'];

const parseJsonObject = (value, fallback) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeThemeColors = (colors = {}) => Object.fromEntries(
  Object.entries(defaultCustomThemeColors).map(([key, fallback]) => [key, normalizeHexColor(colors[key], fallback)])
);

const normalizeThemeName = (value) => String(value || '').replace(/[<>]/g, '').trim().slice(0, 32);

const safeThemeFileName = (value) => {
  const name = normalizeThemeName(value) || 'photo-memory-theme';
  return `${name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 40) || 'photo-memory-theme'}.json`;
};

const hasThemeColorValue = (colors = {}) => Object.keys(defaultCustomThemeColors)
  .some((key) => Boolean(normalizeHexColor(colors?.[key], '')));

const normalizeSavedThemes = (themes = []) => parseJsonArray(themes)
  .map((theme, index) => {
    if (!theme || typeof theme !== 'object') return null;
    const name = normalizeThemeName(theme.name) || `主题 ${index + 1}`;
    return {
      id: String(theme.id || `theme_${Date.now()}_${index}`).replace(/[^\w-]/g, '').slice(0, 48),
      name,
      colors: normalizeThemeColors(theme.colors || {}),
      savedAt: String(theme.savedAt || '').replace(/[<>]/g, '').slice(0, 32)
    };
  })
  .filter(Boolean)
  .slice(0, 16);

const buildThemeExportPayload = () => ({
  type: 'photo-memory-theme',
  version: 1,
  app: 'Photo Memory',
  name: normalizeThemeName(form.themeCustomName) || '未命名主题',
  editorMode: normalizeThemeEditorMode(form.themeCustomEditorMode),
  colors: normalizeThemeColors(form.themeCustomColors),
  exportedAt: new Date().toISOString()
});

const exportCurrentTheme = () => {
  const payload = buildThemeExportPayload();
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeThemeFileName(payload.name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  ElMessage.success('主题方案已导出');
};

const triggerThemeImport = () => {
  themeImportInput.value?.click();
};

const parseImportedTheme = (payload) => {
  const theme = payload?.theme && typeof payload.theme === 'object' ? payload.theme : payload;
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return null;
  const colors = theme.colors || theme.themeCustomColors || {};
  if (!hasThemeColorValue(colors)) return null;
  return {
    id: `theme_${Date.now()}`,
    name: normalizeThemeName(theme.name || theme.themeCustomName) || `导入主题 ${form.savedThemes.length + 1}`,
    editorMode: normalizeThemeEditorMode(theme.editorMode || theme.themeCustomEditorMode),
    colors: normalizeThemeColors(colors),
    savedAt: new Date().toISOString().slice(0, 10)
  };
};

const applyImportedTheme = (theme) => {
  form.themeCustomName = theme.name;
  form.themeCustomEditorMode = theme.editorMode;
  form.themeCustomColors = normalizeThemeColors(theme.colors);
  if (form.themeCustomEditorMode === 'simple') syncSimpleThemeColors();
  form.savedThemes = [theme, ...form.savedThemes.filter((item) => item.name !== theme.name)].slice(0, 16);
  savedThemeId.value = theme.id;
};

const importThemeFile = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json') || file.size > 128 * 1024) {
    ElMessage.error('请选择 128KB 以内的 JSON 主题文件');
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const theme = parseImportedTheme(payload);
    if (!theme) {
      ElMessage.error('主题文件格式不正确，或没有可用颜色');
      return;
    }
    applyImportedTheme(theme);
    ElMessage.success('主题方案已导入，请保存设置后生效');
  } catch {
    ElMessage.error('主题文件解析失败');
  }
};

const hexToRgb = (hex) => {
  const color = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(color.slice(0, 2), 16),
    g: Number.parseInt(color.slice(2, 4), 16),
    b: Number.parseInt(color.slice(4, 6), 16)
  };
};

const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
};

const contrastRatio = (foreground, background) => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
};

const readableOn = (background) => {
  const whiteRatio = contrastRatio('#ffffff', background);
  const darkRatio = contrastRatio('#071012', background);
  return whiteRatio >= darkRatio ? '#ffffff' : '#071012';
};

const simpleColorFields = [
  {
    key: 'primary',
    label: '品牌主色',
    description: '主要按钮、强调色、选中导航等统一跟随',
    targets: [
      'primary',
      'accent',
      'dockActiveBg',
      { key: 'dockActiveText', value: (color) => readableOn(color) }
    ]
  },
  {
    key: 'pageBg',
    label: '页面底色',
    description: '全站最底层背景'
  },
  {
    key: 'surface',
    label: '卡片 / 浮层背景',
    description: '卡片、弹窗、下拉、地图弹窗和地图控件背景',
    targets: ['surface', 'surfaceOverlay', 'mapControlBg', 'mapPopupBg']
  },
  {
    key: 'surfaceSoft',
    label: '柔和面板 / 普通按钮',
    description: '侧栏、次级面板、普通按钮与悬停背景',
    targets: ['surfaceSoft', 'buttonBg', 'buttonHoverBg']
  },
  {
    key: 'text',
    label: '主要文字',
    description: '正文、按钮文字、地图控件和弹窗文字',
    targets: ['text', 'textSoft', 'buttonText', 'mapControlText', 'mapPopupText']
  },
  {
    key: 'muted',
    label: '辅助文字',
    description: '日期、统计、说明等弱化信息'
  },
  {
    key: 'line',
    label: '边框 / 分割线',
    description: '卡片、表格、输入框和分割线'
  },
  {
    key: 'tagBg',
    label: '标签',
    description: '标签底色，文字会自动选择高对比度颜色',
    targets: [
      'tagBg',
      { key: 'tagText', value: (color) => readableOn(color) }
    ]
  },
  {
    key: 'imageOverlayBg',
    label: '照片悬浮遮罩',
    description: '照片卡片内的 EXIF、标签和悬浮信息',
    targets: [
      'imageOverlayBg',
      { key: 'imageOverlayText', value: (color) => readableOn(color) }
    ]
  }
];

const displayedColorFields = computed(() => form.themeCustomEditorMode === 'advanced' ? colorFields : simpleColorFields);

const applySimpleColorTargets = (field, color) => {
  if (!field.targets?.length) return;
  field.targets.forEach((target) => {
    const key = typeof target === 'string' ? target : target.key;
    const nextValue = typeof target?.value === 'function' ? target.value(color, form.themeCustomColors) : color;
    form.themeCustomColors[key] = normalizeHexColor(nextValue, defaultCustomThemeColors[key]);
  });
};

const updateThemeColorField = (field, value) => {
  const color = normalizeHexColor(value, defaultCustomThemeColors[field.key]);
  form.themeCustomColors[field.key] = color;
  if (form.themeCustomEditorMode === 'simple') applySimpleColorTargets(field, color);
};

const syncSimpleThemeColors = () => {
  simpleColorFields.forEach((field) => updateThemeColorField(field, form.themeCustomColors[field.key]));
};

const contrastPairs = [
  { label: '正文 / 页面背景', fg: 'text', bg: 'pageBg', min: 4.5 },
  { label: '正文 / 卡片背景', fg: 'text', bg: 'surface', min: 4.5 },
  { label: '弱化文字 / 卡片背景', fg: 'muted', bg: 'surface', min: 3 },
  { label: '按钮文字 / 按钮背景', fg: 'buttonText', bg: 'buttonBg', min: 4.5 },
  { label: '标签文字 / 标签背景', fg: 'tagText', bg: 'tagBg', min: 4.5 },
  { label: '地图控件文字 / 背景', fg: 'mapControlText', bg: 'mapControlBg', min: 4.5 },
  { label: '地图弹窗文字 / 背景', fg: 'mapPopupText', bg: 'mapPopupBg', min: 4.5 },
  { label: '悬浮导航图标 / 背景', fg: 'dockActiveText', bg: 'dockActiveBg', min: 3 },
  { label: '照片悬浮信息 / 背景', fg: 'imageOverlayText', bg: 'imageOverlayBg', min: 3 }
];

const contrastChecks = computed(() => contrastPairs.map((item) => {
  const foreground = normalizeHexColor(form.themeCustomColors[item.fg], defaultCustomThemeColors[item.fg]);
  const background = normalizeHexColor(form.themeCustomColors[item.bg], defaultCustomThemeColors[item.bg]);
  const ratio = contrastRatio(foreground, background);
  const suggestion = readableOn(background);
  return {
    ...item,
    foreground,
    background,
    ratio,
    suggestion,
    level: ratio >= item.min ? 'pass' : ratio >= item.min - 1 ? 'warn' : 'fail',
    message: ratio >= item.min
      ? '对比度良好'
      : `建议将“${colorFields.find((field) => field.key === item.fg)?.label || item.fg}”改为 ${suggestion}`
  };
}));

const applyContrastSuggestion = (check) => {
  form.themeCustomColors[check.fg] = check.suggestion;
};

const resetCustomThemeColors = () => {
  form.themeCustomColors = { ...defaultCustomThemeColors };
  if (form.themeCustomEditorMode === 'simple') syncSimpleThemeColors();
};

const applySavedTheme = () => {
  const theme = form.savedThemes.find((item) => item.id === savedThemeId.value);
  if (!theme) return;
  form.themeCustomName = theme.name;
  form.themeCustomColors = normalizeThemeColors(theme.colors);
  if (form.themeCustomEditorMode === 'simple') syncSimpleThemeColors();
  ElMessage.success('已应用保存的主题方案');
};

const saveCurrentThemePreset = () => {
  const name = normalizeThemeName(form.themeCustomName) || `主题 ${form.savedThemes.length + 1}`;
  const existing = form.savedThemes.find((item) => item.name === name);
  const preset = {
    id: existing?.id || `theme_${Date.now()}`,
    name: name.slice(0, 32),
    colors: normalizeThemeColors(form.themeCustomColors),
    savedAt: new Date().toISOString().slice(0, 10)
  };
  form.savedThemes = [preset, ...form.savedThemes.filter((item) => item.id !== preset.id)].slice(0, 16);
  savedThemeId.value = preset.id;
  ElMessage.success('主题方案已保存');
};

const removeSavedTheme = () => {
  if (!savedThemeId.value) return;
  form.savedThemes = form.savedThemes.filter((item) => item.id !== savedThemeId.value);
  savedThemeId.value = '';
  ElMessage.success('主题方案已删除');
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
    else if (['uploadMaxSizeMb', 'pageSize', 'trustProxyHops', 'waterfallCardRadius', 'waterfallLoadDurationMs', 'waterfallLoadStaggerMs', ...mapZoomKeys].includes(item.key)) form[item.key] = Number(item.value);
    else if (item.key === 'heroPhotoIds') form.heroPhotoIds = normalizeIds(item.value);
    else if (item.key === 'heroFixedPhotoId') form.heroFixedPhotoId = numberOrNull(item.value);
    else if (item.key === 'heroMode') form.heroMode = item.value === 'fixed' ? 'fixed' : 'random';
    else if (item.key === 'themeMode') form.themeMode = normalizeThemeMode(item.value);
    else if (item.key === 'themeCustomEditorMode') form.themeCustomEditorMode = normalizeThemeEditorMode(item.value);
    else if (item.key === 'themeCustomName') form.themeCustomName = normalizeThemeName(item.value);
    else if (item.key === 'themeCustomColors') form.themeCustomColors = normalizeThemeColors(parseJsonObject(item.value, defaultCustomThemeColors));
    else if (item.key === 'savedThemes') form.savedThemes = normalizeSavedThemes(item.value);
    else if (item.key === 'waterfallRevealAnimation') form.waterfallRevealAnimation = normalizeRevealAnimation(item.value);
    else if (item.key === 'waterfallLoadAnimation') form.waterfallLoadAnimation = normalizeLoadAnimation(item.value);
    else if (item.key === 'mapTileProvider') form.mapTileProvider = normalizeMapProvider(item.value);
    else if (Object.prototype.hasOwnProperty.call(form, item.key)) form[item.key] = item.value;
  });
  await loadHeroOptions();
  syncFixedHero();
});

const save = async () => {
  form.heroPhotoIds = normalizeIds(form.heroPhotoIds);
  form.themeCustomEditorMode = normalizeThemeEditorMode(form.themeCustomEditorMode);
  if (form.themeCustomEditorMode === 'simple') syncSimpleThemeColors();
  syncFixedHero();
  const payload = Object.entries(form).map(([key, value]) => {
    if (key === 'heroPhotoIds') return { key, value: JSON.stringify(normalizeIds(value)) };
    if (key === 'heroFixedPhotoId') return { key, value: value ? String(value) : '' };
    if (key === 'heroMode') return { key, value: value === 'fixed' ? 'fixed' : 'random' };
    if (key === 'themeMode') return { key, value: normalizeThemeMode(value) };
    if (key === 'themeCustomEditorMode') return { key, value: normalizeThemeEditorMode(value) };
    if (key === 'themeCustomName') return { key, value: normalizeThemeName(value) };
    if (key === 'themeCustomColors') return { key, value: JSON.stringify(normalizeThemeColors(value)) };
    if (key === 'savedThemes') return { key, value: JSON.stringify(normalizeSavedThemes(value)) };
    if (key === 'trustProxyHops') return { key, value: String(Math.max(0, Math.min(10, Number(value) || 0))) };
    if (key === 'waterfallCardRadius') {
      const radius = Number(value);
      return { key, value: String(Math.max(0, Math.min(24, Number.isFinite(radius) ? Math.round(radius) : 4))) };
    }
    if (key === 'waterfallRevealAnimation') return { key, value: normalizeRevealAnimation(value) };
    if (key === 'waterfallLoadAnimation') return { key, value: normalizeLoadAnimation(value) };
    if (key === 'waterfallLoadDurationMs') return { key, value: String(Math.max(200, Math.min(1600, Number(value) || 720))) };
    if (key === 'waterfallLoadStaggerMs') return { key, value: String(Math.max(0, Math.min(120, Number(value) || 24))) };
    if (mapZoomKeys.includes(key)) return { key, value: String(normalizeMapZoom(key, value)) };
    if (key === 'mapTileProvider') return { key, value: normalizeMapProvider(value) };
    if (key === 'mapTileUrl') return { key, value: normalizeMapTileUrl(value) };
    if (key === 'mapTileAttribution') return { key, value: String(value || '').replace(/[<>]/g, '').slice(0, 120) };
    if (key === 'baiduMapWebAk' || key === 'baiduMapServerAk') return { key, value: normalizeBaiduAk(value) };
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

watch(() => form.themeCustomEditorMode, (mode) => {
  form.themeCustomEditorMode = normalizeThemeEditorMode(mode);
  if (form.themeCustomEditorMode === 'simple') syncSimpleThemeColors();
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
  border-top: 1px solid var(--theme-line);
  border-bottom: 1px solid var(--theme-line);
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
  color: var(--theme-muted-strong);
  font-size: 13px;
  line-height: 1.7;
}

.settings-section-head.compact h3 {
  margin: 0 0 6px;
  color: var(--theme-text);
  font-size: 15px;
}

.field-help {
  width: 100%;
  margin: 8px 0 0;
  color: var(--theme-muted-strong);
  font-size: 12px;
  line-height: 1.6;
}

.theme-inline-alert {
  border: 1px solid color-mix(in srgb, var(--theme-primary) 36%, var(--theme-line));
  background: color-mix(in srgb, var(--theme-primary-soft) 62%, var(--theme-surface));
  color: var(--theme-text);
}

.theme-inline-alert :deep(.el-alert__title),
.theme-inline-alert :deep(.el-alert__description) {
  color: var(--theme-text);
}

.theme-inline-alert :deep(.el-alert__icon) {
  color: var(--theme-primary);
}

.map-zoom-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--theme-line-faint);
  border-radius: 8px;
  background: var(--theme-surface-soft);
}

.map-zoom-panel > .settings-grid {
  display: none;
}

.map-zoom-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.map-zoom-preview article {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--theme-surface);
}

.map-zoom-card-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.map-zoom-preview span {
  color: var(--theme-muted-strong);
  font-size: 12px;
}

.map-zoom-preview strong {
  color: var(--theme-text);
  font-size: 13px;
}

.map-zoom-preview small {
  color: var(--theme-muted);
  font-size: 12px;
}

.map-zoom-stepper {
  width: 100%;
}

.map-zoom-stepper :deep(.el-input-number__decrease),
.map-zoom-stepper :deep(.el-input-number__increase) {
  border-color: var(--theme-button-border);
  background: var(--theme-button-bg);
  color: var(--theme-button-text);
}

.map-zoom-stepper :deep(.el-input__wrapper) {
  border-color: var(--theme-input-border);
  background: var(--theme-input-bg);
  box-shadow: 0 0 0 1px var(--theme-input-border) inset;
}

.map-zoom-stepper :deep(.el-input__inner) {
  color: var(--theme-input-text);
}

.map-zoom-visual {
  height: 80px;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--theme-map-control-border);
  border-radius: 8px;
  background:
    linear-gradient(45deg, transparent 46%, var(--theme-line-faint) 47%, var(--theme-line-faint) 53%, transparent 54%),
    linear-gradient(-45deg, transparent 46%, var(--theme-line-faint) 47%, var(--theme-line-faint) 53%, transparent 54%),
    var(--theme-map-popup-bg);
}

.map-zoom-visual i {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  border: 2px solid var(--theme-primary);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-primary) 18%, transparent);
  transform: translate(-50%, -50%);
  transition: width 0.24s ease, height 0.24s ease;
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
  color: var(--theme-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-option small {
  overflow: hidden;
  color: var(--theme-muted-strong);
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
  border: 1px solid var(--theme-line);
  border-radius: 6px;
  background: var(--theme-button-bg);
}

.hero-preview-grid article.active {
  border-color: var(--theme-primary);
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
  color: var(--theme-muted-strong);
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
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background-color: var(--theme-button-bg);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.theme-custom-collapse {
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--theme-surface-soft);
}

.theme-custom-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 54px;
  padding: 0 16px;
  border-bottom-color: var(--theme-line);
  background: transparent;
  color: var(--theme-text);
}

.theme-custom-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
  background: transparent;
}

.theme-custom-collapse :deep(.el-collapse-item__content) {
  padding: 0;
}

.theme-collapse-title {
  min-width: 0;
  display: grid;
  gap: 4px;
  line-height: 1.3;
}

.theme-collapse-title strong {
  color: var(--theme-text);
  font-size: 15px;
}

.theme-collapse-title span {
  overflow: hidden;
  color: var(--theme-muted-strong);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-custom-editor {
  display: grid;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--theme-line);
  background: transparent;
}

.theme-custom-toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}

.saved-theme-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
}

.saved-theme-row :deep(.el-button) {
  min-width: 56px;
  background-color: var(--el-button-bg-color);
  border-color: var(--el-button-border-color);
  color: var(--el-button-text-color);
}

.saved-theme-row :deep(.el-button:not(.is-disabled):hover) {
  background-color: var(--el-button-hover-bg-color);
  border-color: var(--el-button-hover-border-color);
  color: var(--el-button-hover-text-color);
}

.theme-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.theme-import-input {
  display: none;
}

.theme-mode-help {
  margin-top: -4px;
}

.theme-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}

.theme-color-grid.simple {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.theme-color-field {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--theme-surface);
}

.theme-color-field span {
  display: grid;
  gap: 4px;
}

.theme-color-field strong {
  color: var(--theme-text);
  font-size: 13px;
}

.theme-color-field small {
  color: var(--theme-muted-strong);
  font-size: 12px;
  line-height: 1.5;
}

.color-input-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.theme-preview-board,
.contrast-grid {
  display: grid;
  gap: 10px;
}

.theme-preview-board {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  padding: 14px;
  border: 1px solid;
  border-radius: 8px;
}

.theme-preview-panel {
  min-height: 138px;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid;
  border-radius: 8px;
}

.preview-head {
  display: grid;
  gap: 4px;
}

.preview-head strong,
.theme-preview-panel p {
  margin: 0;
}

.preview-head span,
.theme-preview-panel small {
  font-size: 12px;
}

.preview-soft {
  margin-top: 4px;
  padding: 9px 10px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
}

.preview-controls,
.preview-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.preview-controls button {
  padding: 8px 14px;
  border: 1px solid;
  border-radius: 999px;
  font-weight: 700;
}

.preview-tag {
  padding: 6px 10px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.preview-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
}

.preview-dock {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-weight: 800;
}

.photo-preview-panel {
  overflow: hidden;
  padding: 0;
}

.preview-photo-image {
  min-height: 170px;
  position: relative;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.22), rgba(0, 0, 0, 0.18)),
    linear-gradient(135deg, #7da5b5, #1c2830 58%, #b88b5e);
}

.preview-photo-overlay {
  position: absolute;
  left: 12px;
  bottom: 12px;
  max-width: calc(100% - 24px);
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 12px;
}

.preview-photo-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 5px 9px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.preview-map-box {
  min-height: 102px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.13) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.13) 50%, rgba(255, 255, 255, 0.13) 75%, transparent 75%),
    linear-gradient(135deg, #8da6ad, #617c83);
  background-size: 22px 22px, auto;
}

.preview-map-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  display: grid;
}

.preview-map-controls button {
  width: 28px;
  height: 28px;
  border: 1px solid;
  font-weight: 800;
}

.preview-marker {
  position: absolute;
  left: 45%;
  top: 48%;
  width: 16px;
  height: 16px;
  border: 3px solid #fff;
  border-radius: 999px;
}

.preview-map-popup {
  position: absolute;
  right: 10px;
  bottom: 10px;
  min-width: 128px;
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 12px;
}

.preview-map-popup span {
  font-size: 11px;
}

.contrast-grid {
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

.contrast-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--theme-surface);
}

.contrast-card > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--theme-text);
  font-size: 13px;
}

.contrast-card p {
  margin: 0;
  color: var(--theme-muted-strong);
  font-size: 12px;
  line-height: 1.55;
}

.contrast-card.pass {
  border-color: color-mix(in srgb, var(--theme-success) 52%, var(--theme-line));
}

.contrast-card.warn {
  border-color: color-mix(in srgb, var(--theme-warning) 60%, var(--theme-line));
  background: color-mix(in srgb, var(--theme-warning) 7%, var(--theme-surface));
}

.contrast-card.fail {
  border-color: color-mix(in srgb, var(--theme-danger) 58%, var(--theme-line));
  background: color-mix(in srgb, var(--theme-danger) 7%, var(--theme-surface));
}

@media (max-width: 760px) {
  .saved-theme-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
