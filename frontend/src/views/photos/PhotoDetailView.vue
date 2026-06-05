<template>
  <LoadingState v-if="loading" class="container section" />
  <template v-else-if="photo">
    <section class="detail-page section">
      <button class="detail-back" type="button" aria-label="返回上一级" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </button>
      <div class="container detail-layout">
        <div class="detail-photo">
          <img :src="imageUrl(photo.mediumUrl || photo.originalUrl)" :alt="photo.title" />
        </div>

        <aside class="detail-side">
          <div class="side-panel parameters">
            <h2>照片参数</h2>
            <ExifInfo :photo="photo" />
          </div>

          <div class="side-panel location-panel">
            <h2>地理位置</h2>
            <template v-if="photo.latitude && photo.longitude">
              <MapViewer :photos="[photo]" :center="[photo.latitude, photo.longitude]" :zoom="11" height="160px" />
              <router-link :to="{ path: '/map', query: { city: photo.city } }">{{ photo.locationName || photo.city || '查看地图页面' }}</router-link>
              <small>{{ photo.city || '未知城市' }} · {{ photo.country || '未知地区' }}</small>
            </template>
            <p v-else class="no-location">暂无地理位置信息</p>
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
            <router-link v-for="item in photo.tags" :key="item.tag.id" :to="`/tags/${item.tag.id}`">#{{ item.tag.name }}</router-link>
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
        <el-form-item label="标签"><el-input v-model="editForm.tags" /></el-form-item>
        <div class="edit-grid">
          <el-form-item label="国家"><el-input v-model="editForm.country" /></el-form-item>
          <el-form-item label="城市"><el-input v-model="editForm.city" /></el-form-item>
          <el-form-item label="地点"><el-input v-model="editForm.locationName" /></el-form-item>
          <el-form-item label="纬度"><el-input v-model="editForm.latitude" /></el-form-item>
          <el-form-item label="经度"><el-input v-model="editForm.longitude" /></el-form-item>
          <el-form-item label="可见性">
            <el-select v-model="editForm.visibility">
              <el-option label="公开" value="public" />
              <el-option label="私密" value="private" />
            </el-select>
          </el-form-item>
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
import { imageUrl } from '../../utils/image.js';
import { readGuestProfile, saveGuestProfile } from '../../utils/guest.js';
import { formatDate, formatDateTime, numberText } from '../../utils/format.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import LoadingState from '../../components/common/LoadingState.vue';
import ExifInfo from '../../components/photo/ExifInfo.vue';
import MapViewer from '../../components/map/MapViewer.vue';

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

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push('/photos');
};

const hydrateEdit = () => {
  Object.assign(editForm, {
    title: photo.value.title,
    description: photo.value.description,
    country: photo.value.country,
    city: photo.value.city,
    locationName: photo.value.locationName,
    latitude: photo.value.latitude,
    longitude: photo.value.longitude,
    visibility: photo.value.visibility,
    tags: photo.value.tags?.map((item) => item.tag.name).join(', ') || ''
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
  const res = await photoApi.update(photo.value.id, editForm);
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
  left: clamp(16px, 2vw, 28px);
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(6, 8, 10, 0.58);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(16px);
  cursor: pointer;
  transition: transform 0.22s ease, color 0.22s ease, background 0.22s ease, border-color 0.22s ease;
}

.detail-back:hover {
  color: #071012;
  border-color: rgba(210, 238, 244, 0.95);
  background: #d2eef4;
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
  color: var(--muted-strong);
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
  color: var(--muted-strong);
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
  border: 1px solid rgba(143, 184, 196, 0.22);
  border-radius: 999px;
  color: color-mix(in srgb, var(--primary) 72%, #ffffff);
  background: rgba(143, 184, 196, 0.1);
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
  color: var(--muted-strong);
}

.comment-list article {
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

.comment-list span {
  color: var(--muted-strong);
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
  color: var(--muted-strong);
  margin: 0;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
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
