<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">点赞记录</h1>
        <p class="section-subtitle">查看每次点赞对应的照片、设备标识、IP 地址与发生时间。</p>
      </div>
      <el-input v-model="query" class="search" clearable placeholder="搜索照片、IP 或设备" @keyup.enter="search" />
    </div>

    <el-table v-loading="loading" :data="likes" class="surface like-table">
      <el-table-column label="照片" width="92">
        <template #default="{ row }"><img class="table-thumb" :src="imageUrl(row.photo?.thumbnailUrl)" :alt="row.photo?.title" /></template>
      </el-table-column>
      <el-table-column prop="photo.title" label="照片标题" min-width="150" />
      <el-table-column label="来源" width="120">
        <template #default="{ row }">{{ row.user?.nickname || row.user?.username || '访客' }}</template>
      </el-table-column>
      <el-table-column prop="ip" label="IP 地址" min-width="140" />
      <el-table-column label="设备标识" min-width="230">
        <template #default="{ row }">
          <div class="hover-cell">
            <button class="cell-preview" type="button">{{ shortText(row.deviceId, 26) }}</button>
            <div class="hover-panel id-panel" role="tooltip">
              <span class="popover-label">设备标识</span>
              <p>{{ row.deviceId || '-' }}</p>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="设备信息" min-width="260">
        <template #default="{ row }">
          <div class="hover-cell">
            <button class="device-summary" type="button">
              <span>{{ deviceSummary(row.userAgent) }}</span>
              <small>{{ shortText(row.userAgent, 32) }}</small>
            </button>
            <div class="hover-panel device-panel" role="tooltip">
              <span class="popover-label">IP 地址</span>
              <p>{{ row.ip || '-' }}</p>
              <span class="popover-label">设备标识</span>
              <p>{{ row.deviceId || '-' }}</p>
              <span class="popover-label">User-Agent</span>
              <p>{{ row.userAgent || '-' }}</p>
              <span class="popover-label">点赞时间</span>
              <p>{{ formatDateTime(row.createdAt) }}</p>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="96">
        <template #default="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '有效' : '已取消' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="点赞时间" min-width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="取消时间" min-width="170">
        <template #default="{ row }">{{ row.removedAt ? formatDateTime(row.removedAt) : '-' }}</template>
      </el-table-column>
    </el-table>

    <Pagination :page="page" :page-size="pageSize" :total="total" @update:page="changePage" @update:page-size="changePageSize" />
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { adminApi } from '../../api/admin.api.js';
import Pagination from '../../components/common/Pagination.vue';
import { formatDateTime } from '../../utils/format.js';
import { imageUrl } from '../../utils/image.js';

const likes = ref([]);
const loading = ref(false);
const query = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const load = async () => {
  loading.value = true;
  try {
    const res = await adminApi.likes({ page: page.value, pageSize: pageSize.value, q: query.value.trim() });
    likes.value = res.data;
    total.value = res.meta?.total || 0;
  } finally {
    loading.value = false;
  }
};

const search = () => {
  page.value = 1;
  load();
};
const changePage = (value) => {
  page.value = value;
  load();
};
const changePageSize = (value) => {
  pageSize.value = value;
  page.value = 1;
  load();
};

const shortText = (value, length = 28) => {
  const text = String(value || '-');
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 3))}...`;
};

const browserName = (ua) => {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Unknown';
};

const osName = (ua) => {
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
};

const deviceSummary = (ua) => {
  const text = String(ua || '');
  if (!text) return '未知设备';
  const mobile = /Mobile|Android|iPhone|iPad/i.test(text) ? '移动端' : '桌面端';
  return `${osName(text)} · ${browserName(text)} · ${mobile}`;
};

onMounted(load);
</script>

<style scoped>
.search {
  width: min(300px, 100%);
}

.like-table {
  overflow: visible;
}

.like-table :deep(.el-table__inner-wrapper),
.like-table :deep(.el-table__body-wrapper),
.like-table :deep(.el-scrollbar__wrap),
.like-table :deep(.el-table__cell),
.like-table :deep(.cell) {
  overflow: visible;
}

.like-table :deep(.el-table__body tr),
.like-table :deep(.el-table__body td) {
  position: relative;
  z-index: 0;
}

.like-table :deep(.el-table__body tr:hover),
.like-table :deep(.el-table__body tr:focus-within),
.like-table :deep(.el-table__body tr:hover td),
.like-table :deep(.el-table__body tr:focus-within td) {
  z-index: 60;
}

.hover-cell {
  position: relative;
  min-width: 0;
  z-index: 1;
}

.hover-cell:hover,
.hover-cell:focus-within {
  z-index: 120;
}

.cell-preview,
.device-summary {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  color: var(--text-soft);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: help;
}

.cell-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 50;
  display: grid;
  gap: 5px;
  width: min(420px, calc(100vw - 32px));
  max-width: 420px;
  padding: 12px 14px;
  border: 1px solid rgba(210, 238, 244, 0.24);
  border-radius: 8px;
  color: var(--text);
  background: rgba(15, 20, 23, 0.98);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.42);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
  pointer-events: none;
}

.id-panel {
  width: min(360px, calc(100vw - 32px));
}

.hover-cell:hover .hover-panel,
.hover-cell:focus-within .hover-panel {
  opacity: 1;
  visibility: visible;
  transform: none;
  pointer-events: auto;
}

.hover-panel::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 18px;
  width: 10px;
  height: 10px;
  border-left: 1px solid rgba(210, 238, 244, 0.24);
  border-top: 1px solid rgba(210, 238, 244, 0.24);
  background: rgba(15, 20, 23, 0.98);
  transform: rotate(45deg);
}

.popover-label {
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 800;
}

.hover-panel p {
  margin: 0 0 6px;
  color: var(--text);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.device-summary {
  display: grid;
  gap: 3px;
}

.device-summary span {
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.device-summary small {
  overflow: hidden;
  color: var(--muted-strong);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
