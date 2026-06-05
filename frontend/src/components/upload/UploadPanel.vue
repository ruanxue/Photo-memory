<template>
  <div class="upload-panel surface">
    <el-form :model="form" label-position="top">
      <div class="upload-grid">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="批量上传时为空则使用文件名" />
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
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="form.tags" placeholder="用逗号分隔，例如：旅行, 夜景, 街头" />
      </el-form-item>
      <el-form-item label="地点">
        <div class="upload-grid">
          <el-input v-model="form.country" placeholder="国家 / 地区" />
          <el-input v-model="form.city" placeholder="城市" />
          <el-input v-model="form.locationName" placeholder="地点名称" />
        </div>
      </el-form-item>
      <EmptyState v-if="!settings.settings.allowUserUpload" title="上传已关闭" description="当前站点暂不允许普通用户上传照片。" />
      <el-upload
        v-else
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
        <div class="drop-tip">支持 jpg、jpeg、png、webp，单张不超过 {{ settings.settings.uploadMaxSizeMb }} MB。HEIC 可先转换后上传。</div>
      </el-upload>
      <el-progress v-if="progress > 0" :percentage="progress" />
      <div class="upload-actions">
        <el-button type="primary" :loading="submitting" @click="submit">开始上传</el-button>
        <el-button @click="clear">清空</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { albumApi } from '../../api/album.api.js';
import { photoApi } from '../../api/photo.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import EmptyState from '../common/EmptyState.vue';

const emit = defineEmits(['uploaded']);
const settings = useSettingsStore();
const uploadRef = ref(null);
const fileList = ref([]);
const albums = ref([]);
const progress = ref(0);
const submitting = ref(false);
const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '私密', value: 'private' }
];
const form = reactive({
  title: '',
  description: '',
  albumId: null,
  tags: '',
  country: '',
  city: '',
  locationName: '',
  visibility: 'public'
});

const loadOptions = async () => {
  const albumRes = await albumApi.list({ pageSize: 100 });
  albums.value = albumRes.data;
};

const onChange = (file, files) => {
  fileList.value = files;
};

const onRemove = (file, files) => {
  fileList.value = files;
};

const clear = () => {
  fileList.value = [];
  progress.value = 0;
  uploadRef.value?.clearFiles();
};

const appendForm = (fd) => {
  Object.entries(form).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') fd.append(key, value);
  });
};

const submit = async () => {
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
    const res = fileList.value.length > 1 ? await photoApi.batchUpload(fd, onUploadProgress) : await photoApi.upload(fd, onUploadProgress);
    ElMessage.success('上传完成');
    emit('uploaded', res.data);
    clear();
  } finally {
    submitting.value = false;
  }
};

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

.drop-title {
  font-weight: 700;
  margin: 12px 0 6px;
}

.drop-tip {
  color: var(--muted-strong);
  font-size: 13px;
}

.upload-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
</style>
