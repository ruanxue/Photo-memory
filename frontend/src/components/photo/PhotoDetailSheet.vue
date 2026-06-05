<template>
  <teleport to="body">
    <transition name="sheet-mask">
      <div v-if="visible" class="detail-mask" @click.self="close" />
    </transition>
    <transition name="detail-sheet">
      <section v-if="visible" class="detail-sheet" role="dialog" aria-modal="true" :aria-label="photo?.title || '照片详情'">
        <header class="sheet-header">
          <div class="grab" />
          <div>
            <p class="eyebrow">PHOTO DETAIL</p>
            <h2>{{ photo?.title || initialPhoto?.title || '照片详情' }}</h2>
          </div>
          <button class="close-button" type="button" aria-label="关闭详情" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <LoadingState v-if="loading" class="sheet-loading" />
        <div v-else-if="photo" class="sheet-scroll">
          <div class="detail-presentation">
            <div class="photo-media">
              <img :src="imageUrl(photo.mediumUrl || photo.thumbnailUrl)" :alt="photo.title" />
            </div>

            <aside class="technical-side">
              <section class="technical-panel">
                <h3>照片参数</h3>
                <ExifInfo :photo="photo" />
              </section>

              <section class="technical-panel location-panel">
                <h3>地理位置</h3>
                <template v-if="photo.latitude && photo.longitude">
                  <MapViewer :photos="[photo]" :center="[photo.latitude, photo.longitude]" :zoom="11" height="150px" />
                  <router-link :to="{ path: '/map', query: { city: photo.city } }" @click="close">
                    {{ photo.locationName || photo.city || '查看地图' }}
                  </router-link>
                  <small>{{ photo.city || '未知城市' }} · {{ photo.country || '未知地区' }}</small>
                </template>
                <p v-else class="muted">暂无地理位置信息</p>
              </section>
            </aside>

            <div class="lead-copy">
              <p class="description">{{ photo.description || '这张照片还没有描述。' }}</p>
              <div class="sheet-actions">
                <el-button :type="photo.liked ? 'primary' : 'default'" @click="toggleLike">
                  {{ photo.liked ? '已点赞' : '点赞' }} {{ numberText(photo.likeCount) }}
                </el-button>
                <el-button :type="photo.favorited ? 'primary' : 'default'" @click="toggleFavorite">
                  {{ photo.favorited ? '已收藏' : '收藏' }} {{ numberText(photo.favoriteCount) }}
                </el-button>
                <el-button @click="share">分享</el-button>
              </div>
              <div class="meta-strip">
                <span>{{ photo.user?.nickname || photo.user?.username }}</span>
                <span>{{ formatDate(photo.takenAt || photo.uploadedAt) }}</span>
                <span>{{ photo.city || photo.locationName || '未知地点' }}</span>
                <span>{{ numberText(photo.viewCount) }} 浏览</span>
              </div>
              <div class="tag-list">
                <router-link v-if="photo.album" :to="`/albums/${photo.album.id}`" @click="close">{{ photo.album.title }}</router-link>
                <router-link v-for="item in photo.tags" :key="item.tag.id" :to="`/tags/${item.tag.id}`" @click="close">
                  #{{ item.tag.name }}
                </router-link>
              </div>
            </div>

            <article v-if="commentsEnabled" class="comments">
              <h3>评论</h3>
              <div class="comment-panel surface">
                <div class="comment-form">
                  <div v-if="!auth.isLoggedIn" class="guest-fields">
                    <el-input v-model="guestName" maxlength="40" placeholder="用户名" />
                    <el-input v-model="guestEmail" maxlength="160" placeholder="邮箱（不会公开显示）" />
                  </div>
                  <el-input v-model="commentText" type="textarea" :rows="3" placeholder="写下你的评论" />
                  <el-button type="primary" @click="submitComment">发布评论</el-button>
                </div>
                <article v-for="comment in comments" :key="comment.id" class="comment-item">
                  <strong>{{ comment.user?.nickname || comment.user?.username || comment.guestName || '访客' }}</strong>
                  <time>{{ formatDateTime(comment.createdAt) }}</time>
                  <p>{{ comment.content }}</p>
                </article>
              </div>
            </article>
            <article v-else class="comments">
              <h3>评论</h3>
              <p class="muted">评论区已关闭</p>
            </article>
          </div>
        </div>
      </section>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Close } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { photoApi } from '../../api/photo.api.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import { imageUrl } from '../../utils/image.js';
import { readGuestProfile, saveGuestProfile } from '../../utils/guest.js';
import { formatDate, formatDateTime, numberText } from '../../utils/format.js';
import LoadingState from '../common/LoadingState.vue';
import ExifInfo from './ExifInfo.vue';
import MapViewer from '../map/MapViewer.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  photoId: { type: Number, default: null },
  initialPhoto: { type: Object, default: null }
});

const emit = defineEmits(['close', 'updated']);
const auth = useAuthStore();
const settings = useSettingsStore();
const route = useRoute();
const router = useRouter();
const photo = ref(null);
const comments = ref([]);
const commentText = ref('');
const savedGuest = readGuestProfile();
const guestName = ref(savedGuest.guestName);
const guestEmail = ref(savedGuest.guestEmail);
const loading = ref(false);
let requestVersion = 0;
const commentsEnabled = computed(() => settings.settings.commentsEnabled !== false);

const close = () => emit('close');

const load = async () => {
  if (!props.visible || !props.photoId) return;
  const version = ++requestVersion;
  photo.value = props.initialPhoto ? { ...props.initialPhoto } : null;
  loading.value = !photo.value;
  try {
    const [detail, commentResult] = await Promise.all([
      photoApi.detail(props.photoId),
      commentsEnabled.value ? photoApi.comments(props.photoId) : Promise.resolve({ data: [] })
    ]);
    if (version !== requestVersion) return;
    photo.value = detail.data;
    comments.value = commentResult.data;
    emit('updated', photo.value);
  } finally {
    if (version === requestVersion) loading.value = false;
  }
};

const requireLogin = () => {
  if (auth.isLoggedIn) return true;
  close();
  router.push({ name: 'login', query: { redirect: route.fullPath } });
  return false;
};

const toggleLike = async () => {
  const result = photo.value.liked ? await photoApi.unlike(photo.value.id) : await photoApi.like(photo.value.id);
  photo.value.liked = result.data.liked;
  photo.value.likeCount = result.data.likeCount;
  emit('updated', photo.value);
};

const toggleFavorite = async () => {
  if (!requireLogin()) return;
  const result = photo.value.favorited ? await photoApi.unfavorite(photo.value.id) : await photoApi.favorite(photo.value.id);
  photo.value.favorited = !photo.value.favorited;
  photo.value.favoriteCount = result.data.favoriteCount;
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
  const result = await photoApi.addComment(photo.value.id, payload);
  commentText.value = '';
  comments.value = (await photoApi.comments(photo.value.id)).data;
  ElMessage.success(result.message || '评论已发布');
};

const share = async () => {
  const url = `${window.location.origin}/photos/${photo.value.id}`;
  if (navigator.share) await navigator.share({ title: photo.value.title, url });
  else {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  }
};

const onKey = (event) => {
  if (props.visible && event.key === 'Escape') close();
};

watch(() => [props.visible, props.photoId], load, { immediate: true });
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.detail-mask {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(3px);
}

.detail-sheet {
  --sheet-height: 90dvh;
  position: fixed;
  z-index: 1051;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--sheet-height);
  overflow: hidden;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px 10px 0 0;
  color: var(--text);
  background: #0c1013;
  box-shadow: 0 -28px 74px rgba(0, 0, 0, 0.52);
}

.sheet-header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 88px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px clamp(18px, 4vw, 44px);
  border-bottom: 1px solid var(--line);
  background: rgba(12, 16, 19, 0.96);
  backdrop-filter: blur(18px);
}

.grab {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 42px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.26);
  transform: translateX(-50%);
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--primary);
  font-size: 10px;
  font-weight: 900;
}

h2 {
  margin: 0;
  font-size: clamp(22px, 3vw, 31px);
}

.close-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  margin-left: auto;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--text);
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
}

.sheet-scroll {
  height: calc(var(--sheet-height) - 88px);
  padding: clamp(18px, 3vw, 36px) clamp(18px, 4vw, 44px) 44px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sheet-loading {
  margin-top: 44px;
}

.detail-presentation {
  max-width: 1320px;
  display: grid;
  grid-template-areas:
    "photo tech"
    "copy tech"
    "comments comments";
  grid-template-columns: minmax(0, 1fr) minmax(280px, 338px);
  align-items: start;
  gap: clamp(20px, 3vw, 32px);
  margin: 0 auto;
}

.photo-media {
  grid-area: photo;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.photo-media img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: min(60dvh, 720px);
  border-radius: 4px;
}

.technical-side {
  grid-area: tech;
  display: grid;
  gap: 18px;
}

.technical-panel {
  display: grid;
  gap: 12px;
}

.technical-panel h3 {
  margin: 0;
}

.location-panel small {
  color: var(--muted-strong);
}

.lead-copy {
  grid-area: copy;
  display: grid;
  align-content: start;
  gap: 18px;
  padding-top: 2px;
}

.description {
  margin: 0;
  color: var(--text-soft);
  font-size: 15px;
  line-height: 1.8;
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  color: var(--muted-strong);
  font-size: 13px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-list a {
  min-height: 29px;
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border: 1px solid rgba(143, 184, 196, 0.25);
  border-radius: 999px;
  color: var(--primary);
  background: rgba(143, 184, 196, 0.09);
  font-size: 13px;
}

h3 {
  margin: 28px 0 15px;
  font-size: 18px;
}

.comments {
  grid-area: comments;
  max-width: 900px;
}

.comment-panel {
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

.comment-item {
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

.comment-item time {
  margin-left: 10px;
  color: var(--muted-strong);
  font-size: 12px;
}

.comment-item p {
  margin: 9px 0 0;
  line-height: 1.6;
}

.detail-sheet-enter-active,
.detail-sheet-leave-active {
  transition: transform 0.42s cubic-bezier(0.22, 0.8, 0.2, 1);
}

.detail-sheet-enter-from,
.detail-sheet-leave-to {
  transform: translateY(100%);
}

.sheet-mask-enter-active,
.sheet-mask-leave-active {
  transition: opacity 0.32s ease;
}

.sheet-mask-enter-from,
.sheet-mask-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .sheet-header {
    min-height: 78px;
    padding: 18px 16px 12px;
  }

  .sheet-scroll {
    height: calc(var(--sheet-height) - 78px);
    padding: 16px 14px 34px;
  }

  .detail-presentation {
    grid-template-areas:
      "photo"
      "copy"
      "tech"
      "comments";
    grid-template-columns: 1fr;
  }

  .photo-media img {
    max-height: min(44dvh, 460px);
  }

  .guest-fields {
    grid-template-columns: 1fr;
  }
}
</style>
