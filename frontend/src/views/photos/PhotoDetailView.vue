<template>
  <LoadingState v-if="loading" class="container section" />
  <template v-else-if="photo">
    <section class="detail-page section">
      <button class="detail-back" type="button" aria-label="返回上一级" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </button>
      <div class="container detail-layout" :class="{ 'detail-layout-simple': !hasTechnicalSide }">
        <div class="detail-photo">
          <img :src="imageUrl(photo.mediumUrl || photo.originalUrl)" :alt="photo.title" />
        </div>

        <aside class="detail-side">
          <div v-if="hasExif" class="side-panel parameters">
            <h2>照片参数</h2>
            <ExifInfo :photo="photo" />
          </div>

          <div v-if="hasGps" class="side-panel location-panel">
            <h2>地理位置</h2>
            <MapViewer
              :photos="[photo]"
              :center="[photo.latitude, photo.longitude]"
              :zoom="detailMapZoom"
              :fit-max-zoom="detailMapZoom"
              :focus-zoom="detailMapZoom"
              height="160px"
              :show-popup="false"
            />
            <router-link :to="{ path: '/map', query: { city: photo.city } }">{{ photo.locationName || photo.city || '查看地图页面' }}</router-link>
            <small>{{ photo.city || '未知城市' }} · {{ photo.country || '未知地区' }}</small>
          </div>

          <div class="surface side-panel">
            <h3>导航</h3>
            <router-link v-if="photo.previous" :to="`/photos/${photo.previous.id}`">上一张：{{ photo.previous.title }}</router-link>
            <router-link v-if="photo.next" :to="`/photos/${photo.next.id}`">下一张：{{ photo.next.title }}</router-link>
            <router-link v-if="photo.album" :to="`/albums/${photo.album.id}`">返回相册</router-link>
          </div>

          <div v-if="canManage" class="surface side-panel">
            <h3>管理</h3>
            <el-button type="primary" @click="editVisible = true">编辑照片</el-button>
            <el-button type="danger" @click="removePhoto">删除照片</el-button>
          </div>
        </aside>

        <article class="detail-main">
          <div class="detail-title">
            <div>
              <h1>{{ photo.title }}</h1>
              <p>{{ photo.description || '这张照片还没有描述。' }}</p>
            </div>
            <div class="detail-actions">
              <el-button :type="photo.favorited ? 'primary' : 'default'" @click="toggleFavorite">{{ photo.favorited ? '已收藏' : '收藏' }}</el-button>
              <el-button @click="share">分享</el-button>
            </div>
          </div>

          <div class="meta-strip surface">
            <span>作者：{{ photo.user?.nickname || photo.user?.username }}</span>
            <span>拍摄：{{ formatDate(photo.takenAt) }}</span>
            <span>上传：{{ formatDate(photo.uploadedAt) }}</span>
            <span>浏览：{{ numberText(photo.viewCount) }}</span>
          </div>

          <div class="story-links">
            <router-link v-if="photo.album" :to="`/albums/${photo.album.id}`">{{ photo.album.title }}</router-link>
            <router-link v-for="item in photo.tags" :key="item.tag.id" :to="{ path: '/photos', query: { tagId: item.tag.id } }">#{{ item.tag.name }}</router-link>
          </div>

          <h2>评论</h2>
          <div v-if="commentsEnabled" class="comment-box surface">
            <div class="comment-form">
              <div v-if="!auth.isLoggedIn" class="guest-fields">
                <el-input v-model="guestName" maxlength="40" placeholder="用户名" />
                <el-input v-model="guestEmail" maxlength="160" placeholder="邮箱（不会公开显示）" />
              </div>
              <el-input v-model="commentText" type="textarea" :rows="3" placeholder="写下你的评论" />
              <el-button type="primary" @click="submitComment">发布评论</el-button>
            </div>
            <div class="comment-list">
              <article v-for="comment in comments" :key="comment.id">
                <strong>{{ comment.user?.nickname || comment.user?.username || comment.guestName || '访客' }}</strong>
                <span>{{ formatDateTime(comment.createdAt) }}</span>
                <p>{{ comment.content }}</p>
              </article>
            </div>
          </div>
          <p v-else class="comment-disabled surface">评论区已关闭</p>
        </article>
      </div>
    </section>

    <el-dialog v-model="editVisible" title="编辑照片" width="620px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="标签"><TagSelect v-model="editForm.tags" placeholder="选择标签" /></el-form-item>
        <div v-if="isExternalPhoto(editForm)" class="external-url-fields">
          <el-form-item label="图片 URL"><el-input v-model="editForm.originalUrl" /></el-form-item>
          <el-form-item label="中图 URL"><el-input v-model="editForm.mediumUrl" /></el-form-item>
          <el-form-item label="缩略图 URL"><el-input v-model="editForm.thumbnailUrl" /></el-form-item>
        </div>
        <div class="edit-grid">
          <el-form-item class="location-editor-item" label="拍摄地点">
            <PhotoLocationEditor v-model="locationModel" />
          </el-form-item>
          <el-form-item label="可见性">
            <el-select v-model="editForm.visibility">
              <el-option label="公开" value="public" />
              <el-option label="私密" value="private" />
            </el-select>
          </el-form-item>
        </div>
        <div class="edit-grid exif-edit-grid">
          <el-form-item label="相机品牌"><el-input v-model="editForm.cameraMake" /></el-form-item>
          <el-form-item label="相机型号"><el-input v-model="editForm.cameraModel" /></el-form-item>
          <el-form-item label="镜头"><el-input v-model="editForm.lensModel" /></el-form-item>
          <el-form-item label="焦距 mm"><el-input v-model="editForm.focalLength" /></el-form-item>
          <el-form-item label="光圈"><el-input v-model="editForm.aperture" /></el-form-item>
          <el-form-item label="快门"><el-input v-model="editForm.shutterSpeed" /></el-form-item>
          <el-form-item label="ISO"><el-input-number v-model="editForm.iso" :min="0" /></el-form-item>
          <el-form-item label="曝光补偿"><el-input v-model="editForm.exposureCompensation" /></el-form-item>
          <el-form-item label="白平衡"><el-input v-model="editForm.whiteBalance" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </template>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { photoApi } from '../../api/photo.api.js';
import { imageUrl, isExternalPhoto } from '../../utils/image.js';
import { hasExifInfo, hasGpsInfo } from '../../utils/exif.js';
import { mapSceneForPhoto, mapZoomForScene } from '../../utils/map.js';
import { readGuestProfile, saveGuestProfile } from '../../utils/guest.js';
import { formatDate, formatDateTime, numberText } from '../../utils/format.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import LoadingState from '../../components/common/LoadingState.vue';
import ExifInfo from '../../components/photo/ExifInfo.vue';
import MapViewer from '../../components/map/MapViewer.vue';
import TagSelect from '../../components/common/TagSelect.vue';
import PhotoLocationEditor from '../../components/map/PhotoLocationEditor.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
const loading = ref(true);
const photo = ref(null);
const comments = ref([]);
const commentText = ref('');
const savedGuest = readGuestProfile();
const guestName = ref(savedGuest.guestName);
const guestEmail = ref(savedGuest.guestEmail);
const editVisible = ref(false);
const editForm = reactive({});
const canManage = computed(() => auth.user && photo.value && (auth.isAdmin || auth.user.id === photo.value.userId));
const commentsEnabled = computed(() => settings.settings.commentsEnabled !== false);
const hasExif = computed(() => hasExifInfo(photo.value));
const hasGps = computed(() => hasGpsInfo(photo.value));
const hasTechnicalSide = computed(() => hasExif.value || hasGps.value);
const detailMapZoom = computed(() => mapZoomForScene(settings.settings, mapSceneForPhoto(photo.value), 'detail'));
const locationModel = computed({
  get: () => ({
    country: editForm.country || '',
    city: editForm.city || '',
    locationName: editForm.locationName || '',
    latitude: editForm.latitude ?? '',
    longitude: editForm.longitude ?? ''
  }),
  set: (value) => {
    editForm.country = value.country || '';
    editForm.city = value.city || '';
    editForm.locationName = value.locationName || '';
    editForm.latitude = value.latitude ?? '';
    editForm.longitude = value.longitude ?? '';
  }
});

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push('/photos');
};

const hydrateEdit = () => {
  Object.assign(editForm, {
    title: photo.value.title,
    description: photo.value.description,
    originalUrl: photo.value.originalUrl || '',
    mediumUrl: photo.value.mediumUrl || '',
    thumbnailUrl: photo.value.thumbnailUrl || '',
    mimeType: photo.value.mimeType || '',
    fileSize: photo.value.fileSize ?? null,
    country: photo.value.country,
    city: photo.value.city,
    locationName: photo.value.locationName,
    latitude: photo.value.latitude,
    longitude: photo.value.longitude,
    cameraMake: photo.value.cameraMake || '',
    cameraModel: photo.value.cameraModel || '',
    lensModel: photo.value.lensModel || '',
    focalLength: photo.value.focalLength ?? '',
    aperture: photo.value.aperture ?? '',
    shutterSpeed: photo.value.shutterSpeed || '',
    iso: photo.value.iso ?? null,
    exposureCompensation: photo.value.exposureCompensation || '',
    whiteBalance: photo.value.whiteBalance || '',
    visibility: photo.value.visibility,
    tags: photo.value.tags?.map((item) => item.tag.name) || []
  });
};

const load = async () => {
  loading.value = true;
  try {
    const [detailRes, commentsRes] = await Promise.all([
      photoApi.detail(route.params.id),
      commentsEnabled.value ? photoApi.comments(route.params.id) : Promise.resolve({ data: [] })
    ]);
    photo.value = detailRes.data;
    comments.value = commentsRes.data;
    hydrateEdit();
  } finally {
    loading.value = false;
  }
};

const toggleFavorite = async () => {
  if (!auth.isLoggedIn) return router.push('/login');
  const res = photo.value.favorited ? await photoApi.unfavorite(photo.value.id) : await photoApi.favorite(photo.value.id);
  photo.value.favorited = !photo.value.favorited;
  photo.value.favoriteCount = res.data.favoriteCount;
};

const submitComment = async () => {
  if (!commentText.value.trim()) return;
  if (!auth.isLoggedIn && (!guestName.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.value.trim()))) {
    ElMessage.warning('请填写用户名和有效邮箱');
    return;
  }
  const payload = { content: commentText.value };
  if (!auth.isLoggedIn) {
    payload.guestName = guestName.value.trim();
    payload.guestEmail = guestEmail.value.trim();
    saveGuestProfile(payload);
  }
  const submitted = await photoApi.addComment(photo.value.id, payload);
  commentText.value = '';
  const res = await photoApi.comments(photo.value.id);
  comments.value = res.data;
  ElMessage.success(submitted.message || '评论已发布');
};

const share = async () => {
  const url = window.location.href;
  if (navigator.share) await navigator.share({ title: photo.value.title, url });
  else {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  }
};

const saveEdit = async () => {
  const payload = { ...editForm };
  if (!isExternalPhoto(editForm)) {
    delete payload.originalUrl;
    delete payload.mediumUrl;
    delete payload.thumbnailUrl;
  } else {
    payload.mediumUrl = payload.mediumUrl || payload.originalUrl;
    payload.thumbnailUrl = payload.thumbnailUrl || payload.mediumUrl || payload.originalUrl;
  }
  const res = await photoApi.update(photo.value.id, payload);
  photo.value = res.data;
  editVisible.value = false;
  ElMessage.success('照片已更新');
};

const removePhoto = async () => {
  await ElMessageBox.confirm('删除后照片文件也会被移除，确定继续吗？', '删除照片', { type: 'warning' });
  await photoApi.remove(photo.value.id);
  ElMessage.success('照片已删除');
  router.push('/photos');
};

onMounted(load);
watch(() => route.params.id, load);
</script>

<style scoped>
.detail-back {
  position: fixed;
  top: clamp(16px, 2vw, 28px);
  left: clamp(8px, 1vw, 14px);
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--theme-dock-border);
  border-radius: 999px;
  color: var(--theme-dock-text);
  background: var(--theme-dock-bg);
  box-shadow: var(--theme-shadow);
  backdrop-filter: blur(16px);
  cursor: pointer;
  transition: transform 0.22s ease, color 0.22s ease, background 0.22s ease, border-color 0.22s ease;
}

.detail-back:hover {
  color: var(--theme-dock-active-text);
  border-color: var(--theme-dock-active-bg);
  background: var(--theme-dock-active-bg);
  transform: translateY(-2px);
}

.detail-page {
  padding-top: clamp(22px, 4vw, 48px);
}

.detail-layout {
  display: grid;
  grid-template-areas:
    "photo side"
    "main side";
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  align-items: start;
  gap: clamp(22px, 3vw, 34px);
}

.detail-layout-simple {
  max-width: min(980px, calc(100vw - 28px));
  grid-template-areas:
    "photo"
    "main"
    "side";
  grid-template-columns: minmax(0, 1fr);
}

.detail-layout-simple .detail-photo img {
  max-height: min(76dvh, 900px);
}

.detail-layout-simple .detail-main {
  max-width: 760px;
  width: 100%;
  justify-self: center;
}

.detail-layout-simple .detail-side {
  width: min(520px, 100%);
  justify-self: center;
  position: static;
}

.detail-photo {
  grid-area: photo;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.detail-photo img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: min(74dvh, 920px);
  border-radius: 4px;
}

.detail-main {
  grid-area: main;
}

.detail-side {
  grid-area: side;
  display: grid;
  gap: 18px;
  position: sticky;
  top: 22px;
}

.detail-title {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-top: clamp(22px, 3vw, 32px);
}

h1 {
  font-size: clamp(32px, 4vw, 54px);
  margin: 0 0 10px;
}

h2 {
  margin: 34px 0 16px;
}

.detail-title p {
  color: var(--theme-muted-strong);
  line-height: 1.8;
}

.detail-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-content: start;
}

.meta-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  padding: 14px;
  color: var(--theme-muted-strong);
}

.story-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.story-links a {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--theme-tag-border);
  border-radius: 999px;
  color: var(--theme-primary-strong);
  background: var(--theme-tag-bg);
  font-size: 13px;
}

.comment-box {
  padding: 16px;
}

.comment-form {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}

.comment-form .el-button {
  justify-self: end;
}

.guest-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.comment-disabled {
  padding: 18px;
  color: var(--theme-muted-strong);
}

.comment-list article {
  padding: 14px 0;
  border-top: 1px solid var(--theme-line);
}

.comment-list span {
  color: var(--theme-muted-strong);
  margin-left: 10px;
  font-size: 13px;
}

.side-panel {
  padding: 16px;
  display: grid;
  gap: 10px;
}

.parameters,
.location-panel {
  padding: 0;
}

.parameters h2,
.location-panel h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.side-panel > a {
  display: block;
  line-height: 1.55;
}

.detail-side :deep(.el-button) {
  width: 100%;
  margin-left: 0 !important;
}

.location-panel small,
.no-location {
  color: var(--theme-muted-strong);
  margin: 0;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.location-editor-item {
  grid-column: 1 / -1;
}

.external-url-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-radius);
  background: var(--theme-surface-soft);
}

.exif-edit-grid {
  margin-top: 10px;
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-areas:
      "photo"
      "main"
      "side";
    grid-template-columns: 1fr;
  }

  .detail-side {
    position: static;
  }

  .detail-title {
    flex-direction: column;
  }

  .detail-photo img {
    max-height: min(56dvh, 640px);
  }

  .guest-fields {
    grid-template-columns: 1fr;
  }
}
</style>
