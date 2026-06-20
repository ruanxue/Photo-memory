<template>
  <div class="upload-panel surface">
    <el-form :model="form" label-position="top">
      <el-form-item label="添加方式">
        <el-segmented v-model="uploadMode" :options="uploadModeOptions" />
      </el-form-item>

      <div class="upload-grid">
        <el-form-item label="标题">
          <el-input
            v-model="form.title"
            :placeholder="uploadMode === 'file' ? '批量上传时为空则使用文件名' : '为空则使用 URL 文件名'"
            clearable
          />
        </el-form-item>

        <el-form-item label="可见性">
          <el-segmented v-model="form.visibility" :options="visibilityOptions" />
        </el-form-item>

        <el-form-item label="相册">
          <el-select v-model="form.albumId" clearable placeholder="选择相册">
            <el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item label="瀑布流展示">
        <el-checkbox v-model="form.showInWaterfall">归档进相册后仍作为照片卡片单独展示</el-checkbox>
        <p class="drop-tip">未选择相册的照片会正常进入瀑布流；选择相册后默认只作为相册内容展示，开启后才会重复显示为照片卡片。</p>
      </el-form-item>

      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>

      <el-form-item label="标签">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择已有标签"
        >
          <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.name" />
        </el-select>
      </el-form-item>

      <el-form-item label="地点">
        <div class="upload-grid">
          <el-select
            v-model="form.country"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="国家 / 地区"
          >
            <el-option v-for="item in countryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-select
            v-model="form.city"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="城市"
          >
            <el-option v-for="item in cityOptions" :key="item.key" :label="item.label" :value="item.value" />
          </el-select>
          <el-input v-model="form.locationName" placeholder="地点名称" clearable />
        </div>
      </el-form-item>

      <EmptyState
        v-if="!settings.settings.allowUserUpload"
        title="上传已关闭"
        description="当前站点暂不允许普通用户上传照片。"
      />

      <template v-else-if="uploadMode === 'file'">
        <el-upload
          ref="uploadRef"
          drag
          multiple
          :auto-upload="false"
          :file-list="fileList"
          :on-change="onChange"
          :on-remove="onRemove"
          accept=".jpg,.jpeg,.png,.webp"
        >
          <div class="drop-title">拖拽照片到这里，或点击选择</div>
          <div class="drop-tip">
            支持 jpg、jpeg、png、webp，单张不超过 {{ settings.settings.uploadMaxSizeMb }} MB。HEIC 可先转换后上传。
          </div>
        </el-upload>
        <el-progress v-if="progress > 0" :percentage="progress" />
      </template>

      <template v-else>
        <el-form-item label="图片 URL">
          <el-input
            v-model="form.imageUrl"
            placeholder="粘贴图床图片 URL，例如：https://img.example.com/photo.jpg"
            clearable
          />
          <p class="drop-tip">
            服务器只保存这个地址，不下载、不转存；访客浏览时会直接从图床加载图片，用来节省服务器流量。
          </p>
        </el-form-item>

        <div class="upload-grid">
          <el-form-item label="缩略图 URL（可选）">
            <el-input v-model="form.thumbnailUrl" placeholder="不填则使用图片 URL" clearable />
          </el-form-item>
          <el-form-item label="中图 URL（可选）">
            <el-input v-model="form.mediumUrl" placeholder="不填则使用图片 URL" clearable />
          </el-form-item>
          <el-form-item label="拍摄日期（可选）">
            <el-date-picker v-model="form.takenAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
          </el-form-item>
        </div>

        <div class="upload-grid">
          <el-form-item label="宽度 px（可选）">
            <el-input-number v-model="form.width" :min="0" :max="200000" />
          </el-form-item>
          <el-form-item label="高度 px（可选）">
            <el-input-number v-model="form.height" :min="0" :max="200000" />
          </el-form-item>
        </div>

        <img
          v-if="form.imageUrl"
          class="url-preview"
          :src="form.imageUrl"
          alt="外链图片预览"
          draggable="false"
        />
      </template>

      <div class="upload-actions">
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ uploadMode === 'file' ? '开始上传' : '添加外链照片' }}
        </el-button>
        <el-button @click="clear">清空</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { albumApi } from '../../api/album.api.js';
import { photoApi } from '../../api/photo.api.js';
import { tagApi } from '../../api/tag.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import EmptyState from '../common/EmptyState.vue';

const emit = defineEmits(['uploaded']);
const settings = useSettingsStore();
const uploadRef = ref(null);
const uploadMode = ref('file');
const fileList = ref([]);
const albums = ref([]);
const tags = ref([]);
const locationOptions = ref({ countries: [], cities: [] });
const progress = ref(0);
const submitting = ref(false);

const uploadModeOptions = [
  { label: '本地文件', value: 'file' },
  { label: '图片 URL', value: 'url' }
];

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '私密', value: 'private' }
];

const initialForm = () => ({
  title: '',
  description: '',
  albumId: null,
  tags: [],
  country: '',
  city: '',
  locationName: '',
  visibility: 'public',
  imageUrl: '',
  mediumUrl: '',
  thumbnailUrl: '',
  takenAt: '',
  width: null,
  height: null,
  showInWaterfall: false
});

const form = reactive(initialForm());

const countryOptions = computed(() => (locationOptions.value.countries || []).map((item) => ({
  value: item.country,
  label: item.count ? `${item.country} (${item.count})` : item.country
})));

const cityOptions = computed(() => (locationOptions.value.cities || [])
  .filter((item) => !form.country || item.country === form.country)
  .map((item) => ({
    key: `${item.country || 'unknown'}-${item.city}`,
    value: item.city,
    label: item.count ? `${item.city} (${item.count})` : item.city
  })));

const loadOptions = async () => {
  const [albumRes, tagRes, filterRes] = await Promise.all([
    albumApi.list({ pageSize: 100 }),
    tagApi.list(),
    photoApi.filterOptions()
  ]);
  albums.value = albumRes.data || [];
  tags.value = tagRes.data || [];
  locationOptions.value = filterRes.data || { countries: [], cities: [] };
};

const onChange = (file, files) => {
  fileList.value = files;
};

const onRemove = (file, files) => {
  fileList.value = files;
};

const resetForm = () => {
  Object.assign(form, initialForm());
};

const clear = () => {
  fileList.value = [];
  progress.value = 0;
  resetForm();
  uploadRef.value?.clearFiles();
};

const appendForm = (fd) => {
  Object.entries(form).forEach(([key, value]) => {
    if (['imageUrl', 'mediumUrl', 'thumbnailUrl', 'takenAt', 'width', 'height'].includes(key)) return;
    if (Array.isArray(value)) {
      if (value.length) fd.append(key, value.join(','));
      return;
    }
    if (value !== null && value !== undefined && value !== '') fd.append(key, value);
  });
};

const sharedPayload = () => {
  const payload = {};
  Object.entries(form).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) payload[key] = value;
      return;
    }
    if (value !== null && value !== undefined && value !== '') payload[key] = value;
  });
  return payload;
};

const submitUrl = async () => {
  if (!form.imageUrl.trim()) {
    ElMessage.warning('请先填写图片 URL');
    return;
  }
  submitting.value = true;
  try {
    const res = await photoApi.createFromUrl(sharedPayload());
    ElMessage.success('外链照片已添加');
    emit('uploaded', res.data);
    clear();
  } finally {
    submitting.value = false;
  }
};

const submitFile = async () => {
  if (!fileList.value.length) {
    ElMessage.warning('请先选择照片');
    return;
  }

  const maxBytes = Number(settings.settings.uploadMaxSizeMb || 15) * 1024 * 1024;
  if (fileList.value.some((file) => file.raw?.size > maxBytes)) {
    ElMessage.warning(`单张图片不能超过 ${settings.settings.uploadMaxSizeMb} MB`);
    return;
  }

  const fd = new FormData();
  appendForm(fd);
  fileList.value.forEach((file) => fd.append(fileList.value.length > 1 ? 'photos' : 'photo', file.raw));
  submitting.value = true;
  progress.value = 1;
  try {
    const onUploadProgress = (event) => {
      if (event.total) progress.value = Math.round((event.loaded * 100) / event.total);
    };
    const res =
      fileList.value.length > 1
        ? await photoApi.batchUpload(fd, onUploadProgress)
        : await photoApi.upload(fd, onUploadProgress);
    ElMessage.success('上传完成');
    emit('uploaded', res.data);
    clear();
  } finally {
    submitting.value = false;
  }
};

const submit = () => {
  if (uploadMode.value === 'url') return submitUrl();
  return submitFile();
};

watch(() => form.country, (country, previous) => {
  if (country === previous || !form.city) return;
  const selectedCity = (locationOptions.value.cities || []).find((item) => item.city === form.city);
  if (selectedCity && selectedCity.country && selectedCity.country !== country) form.city = '';
});

onMounted(loadOptions);
</script>

<style scoped>
.upload-panel {
  padding: 18px;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  width: 100%;
}

.upload-panel :deep(.el-select),
.upload-panel :deep(.el-date-editor) {
  width: 100%;
}

.drop-title {
  margin: 12px 0 6px;
  font-weight: 700;
}

.drop-tip {
  width: 100%;
  margin: 8px 0 0;
  color: var(--theme-muted-strong);
  font-size: 13px;
  line-height: 1.6;
}

.url-preview {
  display: block;
  max-width: min(100%, 520px);
  max-height: 320px;
  margin-top: 6px;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-radius);
  object-fit: contain;
  background: var(--theme-surface-soft);
}

.upload-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
</style>
