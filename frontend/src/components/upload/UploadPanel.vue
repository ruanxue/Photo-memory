<template>
  <div class="upload-panel surface">
    <el-form :model="urlForm" label-position="top">
      <div class="upload-topline">
        <el-form-item label="添加方式">
          <el-segmented v-model="uploadMode" :options="uploadModeOptions" />
        </el-form-item>
        <p class="upload-note">
          本地照片会进入待上传清单，每张照片都可以单独编辑标题、标签、地点和 EXIF。
        </p>
      </div>

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
          :show-file-list="false"
          :on-change="onFileChange"
          accept=".jpg,.jpeg,.png,.webp"
        >
          <div class="drop-title">拖拽照片到这里，或点击选择</div>
          <div class="drop-tip">
            支持 jpg、jpeg、png、webp，单张不超过 {{ settings.settings.uploadMaxSizeMb }} MB。加入清单后会默认使用文件名作为照片标题。
          </div>
        </el-upload>

        <div class="queue-head">
          <div>
            <strong>待上传清单</strong>
            <span>{{ queueItems.length }} 张照片</span>
          </div>
          <el-button :disabled="!queueItems.length || submitting" @click="clear">清空清单</el-button>
        </div>

        <EmptyState
          v-if="!queueItems.length"
          title="还没有选择照片"
          description="选择照片后，它们会以列表形式出现在这里。"
        />

        <div v-else class="upload-queue">
          <article
            v-for="item in queueItems"
            :key="item.uid"
            class="upload-row"
            :class="[`status-${item.status}`, { expanded: item.expanded }]"
          >
            <div class="row-main">
              <div class="thumb-wrap">
                <img class="queue-thumb" :src="item.previewUrl" :alt="item.title || item.file.name" draggable="false" />
              </div>

              <div class="row-fields">
                <div class="queue-inline">
                  <el-input class="queue-title-input" v-model="item.title" placeholder="照片标题" clearable />
                  <TagSelect class="queue-tag-select" v-model="item.tags" placeholder="选择标签" />
                  <span class="meta-pill" :class="{ ready: hasExifMeta(item), checking: item.exifStatus === 'checking' }">
                    {{ exifStatusLabel(item) }}
                  </span>
                  <span class="meta-pill" :class="{ ready: hasLocation(item), checking: item.gpsStatus === 'checking' }">
                    {{ locationStatusLabel(item) }}
                  </span>
                  <el-tag v-if="item.status !== 'waiting'" :type="statusTagType(item.status)" effect="plain">
                    {{ statusLabel(item.status) }}
                  </el-tag>
                </div>

                <div class="meta-line">
                  <span>{{ formatFileSize(item.file.size) }}</span>
                  <span>{{ item.file.type || fileExt(item.file.name) }}</span>
                </div>

                <el-progress v-if="item.status === 'uploading' || item.progress > 0" :percentage="item.progress" />
                <p v-if="item.error" class="row-error">{{ item.error }}</p>
              </div>

              <div class="row-actions">
                <el-button @click="item.expanded = !item.expanded">
                  {{ item.expanded ? '收起信息' : '编辑信息' }}
                </el-button>
                <el-button type="danger" plain :disabled="item.status === 'uploading'" @click="removeItem(item.uid)">移除</el-button>
              </div>
            </div>

            <transition name="queue-detail">
              <div v-if="item.expanded" class="row-detail">
                <div class="detail-grid">
                  <el-form-item label="相册">
                    <el-select v-model="item.albumId" clearable placeholder="选择相册">
                      <el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="可见性">
                    <el-segmented v-model="item.visibility" :options="visibilityOptions" />
                  </el-form-item>
                </div>

                <el-form-item label="描述">
                  <el-input v-model="item.description" type="textarea" :rows="3" placeholder="写一点这张照片的故事" />
                </el-form-item>

                <el-form-item label="拍摄地点">
                  <PhotoLocationEditor v-model="item.location" :location-options="locationOptions" />
                </el-form-item>

                <el-collapse v-model="item.exifCollapse" class="meta-collapse">
                  <el-collapse-item name="exif">
                    <template #title>
                      <span class="collapse-title">EXIF 手动补充</span>
                      <span class="collapse-subtitle">后端会优先读取原图 EXIF；这里用于没有 EXIF 或需要修正的照片。</span>
                    </template>
                    <div class="detail-grid exif-grid">
                      <el-form-item label="相机品牌"><el-input v-model="item.exif.cameraMake" /></el-form-item>
                      <el-form-item label="相机型号"><el-input v-model="item.exif.cameraModel" /></el-form-item>
                      <el-form-item label="镜头"><el-input v-model="item.exif.lensModel" /></el-form-item>
                      <el-form-item label="焦距 mm"><el-input v-model="item.exif.focalLength" /></el-form-item>
                      <el-form-item label="光圈"><el-input v-model="item.exif.aperture" /></el-form-item>
                      <el-form-item label="快门"><el-input v-model="item.exif.shutterSpeed" /></el-form-item>
                      <el-form-item label="ISO"><el-input-number v-model="item.exif.iso" :min="0" /></el-form-item>
                      <el-form-item label="曝光补偿"><el-input v-model="item.exif.exposureCompensation" /></el-form-item>
                      <el-form-item label="白平衡"><el-input v-model="item.exif.whiteBalance" /></el-form-item>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </transition>
          </article>
        </div>
      </template>

      <template v-else>
        <div class="upload-grid">
          <el-form-item label="标题">
            <el-input v-model="urlForm.title" placeholder="为空则使用 URL 文件名" clearable />
          </el-form-item>
          <el-form-item label="可见性">
            <el-segmented v-model="urlForm.visibility" :options="visibilityOptions" />
          </el-form-item>
          <el-form-item label="相册">
            <el-select v-model="urlForm.albumId" clearable placeholder="选择相册">
              <el-option v-for="album in albums" :key="album.id" :label="album.title" :value="album.id" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="图片 URL">
          <el-input
            v-model="urlForm.imageUrl"
            placeholder="粘贴图床图片 URL，例如：https://img.example.com/photo.jpg"
            clearable
          />
          <p class="drop-tip">
            服务器只保存这个地址，不下载、不转存；访客浏览时会直接从图床加载图片，用来节省服务器流量。
          </p>
        </el-form-item>

        <el-form-item label="描述">
          <el-input v-model="urlForm.description" type="textarea" :rows="3" placeholder="写一点这张照片的故事" />
        </el-form-item>

        <div class="upload-grid">
          <el-form-item label="缩略图 URL（可选）">
            <el-input v-model="urlForm.thumbnailUrl" placeholder="不填则使用图片 URL" clearable />
          </el-form-item>
          <el-form-item label="中图 URL（可选）">
            <el-input v-model="urlForm.mediumUrl" placeholder="不填则使用图片 URL" clearable />
          </el-form-item>
          <el-form-item label="拍摄日期（可选）">
            <el-date-picker v-model="urlForm.takenAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
          </el-form-item>
        </div>

        <div class="upload-grid">
          <el-form-item label="宽度 px（可选）">
            <el-input-number v-model="urlForm.width" :min="0" :max="200000" />
          </el-form-item>
          <el-form-item label="高度 px（可选）">
            <el-input-number v-model="urlForm.height" :min="0" :max="200000" />
          </el-form-item>
        </div>

        <el-form-item label="标签">
          <TagSelect v-model="urlForm.tags" placeholder="选择标签" />
        </el-form-item>

        <el-form-item label="拍摄地点">
          <PhotoLocationEditor v-model="urlLocationModel" :location-options="locationOptions" collapsible :initial-open="false" />
        </el-form-item>

        <img
          v-if="urlForm.imageUrl"
          class="url-preview"
          :src="urlForm.imageUrl"
          alt="外链图片预览"
          draggable="false"
          @error="handleImageError"
        />
      </template>

      <div class="upload-actions">
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ uploadMode === 'file' ? '开始上传清单' : '添加外链照片' }}
        </el-button>
        <el-button @click="clear">清空</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { albumApi } from '../../api/album.api.js';
import { photoApi } from '../../api/photo.api.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import EmptyState from '../common/EmptyState.vue';
import TagSelect from '../common/TagSelect.vue';
import PhotoLocationEditor from '../map/PhotoLocationEditor.vue';
import { handleImageError } from '../../utils/image.js';

const emit = defineEmits(['uploaded']);
const settings = useSettingsStore();
const uploadRef = ref(null);
const uploadMode = ref('file');
const queueItems = ref([]);
const albums = ref([]);
const locationOptions = ref({ countries: [], cities: [] });
const submitting = ref(false);

const uploadModeOptions = [
  { label: '本地文件', value: 'file' },
  { label: '图片 URL', value: 'url' }
];

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '私密', value: 'private' }
];

const initialUrlForm = () => ({
  title: '',
  description: '',
  albumId: null,
  tags: [],
  country: '',
  city: '',
  locationName: '',
  latitude: '',
  longitude: '',
  visibility: 'public',
  imageUrl: '',
  mediumUrl: '',
  thumbnailUrl: '',
  takenAt: '',
  width: null,
  height: null
});

const urlForm = reactive(initialUrlForm());

const urlLocationModel = computed({
  get: () => ({
    country: urlForm.country,
    city: urlForm.city,
    locationName: urlForm.locationName,
    latitude: urlForm.latitude,
    longitude: urlForm.longitude
  }),
  set: (value) => {
    urlForm.country = value.country || '';
    urlForm.city = value.city || '';
    urlForm.locationName = value.locationName || '';
    urlForm.latitude = value.latitude || '';
    urlForm.longitude = value.longitude || '';
  }
});

const titleFromFile = (name = '') => name.replace(/\.[^.]+$/, '').trim() || '未命名照片';
const fileExt = (name = '') => name.split('.').pop()?.toUpperCase() || '未知格式';

const formatFileSize = (bytes = 0) => {
  if (!bytes) return '0 KB';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.max(bytes / 1024, 1).toFixed(0)} KB`;
};

const readAscii = (view, offset, length) => {
  if (offset < 0 || offset + length > view.byteLength) return '';
  let text = '';
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (!code) break;
    text += String.fromCharCode(code);
  }
  return text.trim();
};

const tiffValueOffset = (view, tiffStart, entryOffset, type, count, littleEndian) => {
  const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const size = (typeSizes[type] || 1) * count;
  if (size <= 4) return entryOffset + 8;
  const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
  return tiffStart + valueOffset;
};

const readTiffText = (view, tiffStart, entryOffset, type, count, littleEndian) => {
  if (type !== 2 || !count) return '';
  const offset = tiffValueOffset(view, tiffStart, entryOffset, type, count, littleEndian);
  return readAscii(view, offset, count);
};

const readTiffRational = (view, offset, littleEndian) => {
  if (offset < 0 || offset + 8 > view.byteLength) return null;
  const numerator = view.getUint32(offset, littleEndian);
  const denominator = view.getUint32(offset + 4, littleEndian);
  return denominator ? numerator / denominator : null;
};

const readGpsCoordinate = (view, tiffStart, entry, littleEndian) => {
  if (!entry || entry.type !== 5 || entry.count < 3) return null;
  const offset = tiffValueOffset(view, tiffStart, entry.entryOffset, entry.type, entry.count, littleEndian);
  const degrees = readTiffRational(view, offset, littleEndian);
  const minutes = readTiffRational(view, offset + 8, littleEndian);
  const seconds = readTiffRational(view, offset + 16, littleEndian);
  if ([degrees, minutes, seconds].some((value) => value === null)) return null;
  return degrees + minutes / 60 + seconds / 3600;
};

const parseIfd = (view, tiffStart, ifdOffset, littleEndian) => {
  const absolute = tiffStart + ifdOffset;
  if (!ifdOffset || absolute < 0 || absolute + 2 > view.byteLength) return [];
  const count = view.getUint16(absolute, littleEndian);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const entryOffset = absolute + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    entries.push({
      tag: view.getUint16(entryOffset, littleEndian),
      type: view.getUint16(entryOffset + 2, littleEndian),
      count: view.getUint32(entryOffset + 4, littleEndian),
      value: view.getUint32(entryOffset + 8, littleEndian),
      entryOffset
    });
  }
  return entries;
};

const readJpegExifStatus = async (rawFile) => {
  if (!rawFile || !/jpe?g$/i.test(rawFile.name || '') || !/jpe?g/i.test(rawFile.type || 'jpeg')) {
    return { supported: false, hasExif: false, hasGps: false };
  }
  // EXIF APP1 lives near the start of JPEG files. Scanning a small head slice keeps
  // the pending upload list responsive even when users add many large photos.
  const scanBytes = Math.min(rawFile.size || 0, 1024 * 1024);
  const buffer = await rawFile.slice(0, scanBytes).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return { supported: true, hasExif: false, hasGps: false };

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) break;
    const segmentStart = offset + 4;
    if (marker === 0xe1 && readAscii(view, segmentStart, 6) === 'Exif') {
      const tiffStart = segmentStart + 6;
      const endian = readAscii(view, tiffStart, 2);
      const littleEndian = endian === 'II';
      if (!littleEndian && endian !== 'MM') return { supported: true, hasExif: true, hasGps: false };
      if (tiffStart + 8 > view.byteLength) return { supported: true, hasExif: true, hasGps: false };
      const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifd0 = parseIfd(view, tiffStart, firstIfdOffset, littleEndian);
      const makeEntry = ifd0.find((entry) => entry.tag === 0x010f);
      const modelEntry = ifd0.find((entry) => entry.tag === 0x0110);
      const gpsEntry = ifd0.find((entry) => entry.tag === 0x8825);
      const exifEntry = ifd0.find((entry) => entry.tag === 0x8769);
      const gpsEntries = gpsEntry ? parseIfd(view, tiffStart, gpsEntry.value, littleEndian) : [];
      const latitudeEntry = gpsEntries.find((entry) => entry.tag === 0x0002);
      const latitudeRefEntry = gpsEntries.find((entry) => entry.tag === 0x0001);
      const longitudeEntry = gpsEntries.find((entry) => entry.tag === 0x0004);
      const longitudeRefEntry = gpsEntries.find((entry) => entry.tag === 0x0003);
      const latitudeRef = latitudeRefEntry ? readTiffText(view, tiffStart, latitudeRefEntry.entryOffset, latitudeRefEntry.type, latitudeRefEntry.count, littleEndian) : '';
      const longitudeRef = longitudeRefEntry ? readTiffText(view, tiffStart, longitudeRefEntry.entryOffset, longitudeRefEntry.type, longitudeRefEntry.count, littleEndian) : '';
      const rawLatitude = readGpsCoordinate(view, tiffStart, latitudeEntry, littleEndian);
      const rawLongitude = readGpsCoordinate(view, tiffStart, longitudeEntry, littleEndian);
      const latitude = rawLatitude === null ? null : (latitudeRef.toUpperCase().startsWith('S') ? -rawLatitude : rawLatitude);
      const longitude = rawLongitude === null ? null : (longitudeRef.toUpperCase().startsWith('W') ? -rawLongitude : rawLongitude);
      const hasGps = Number.isFinite(latitude) && Number.isFinite(longitude);
      return {
        supported: true,
        hasExif: true,
        hasGps,
        latitude,
        longitude,
        cameraMake: makeEntry ? readTiffText(view, tiffStart, makeEntry.entryOffset, makeEntry.type, makeEntry.count, littleEndian) : '',
        cameraModel: modelEntry ? readTiffText(view, tiffStart, modelEntry.entryOffset, modelEntry.type, modelEntry.count, littleEndian) : '',
        exifEntryCount: exifEntry ? parseIfd(view, tiffStart, exifEntry.value, littleEndian).length : 0
      };
    }
    offset += 2 + segmentLength;
  }
  return { supported: true, hasExif: false, hasGps: false };
};

const maxBytes = computed(() => Number(settings.settings.uploadMaxSizeMb || 15) * 1024 * 1024);

const createQueueItem = (file) => ({
  uid: `${file.uid || Date.now()}-${Math.random().toString(16).slice(2)}`,
  file,
  raw: file.raw,
  previewUrl: URL.createObjectURL(file.raw),
  title: titleFromFile(file.name),
  description: '',
  albumId: null,
  visibility: 'public',
  tags: [],
  location: { country: '', city: '', locationName: '', latitude: '', longitude: '' },
  exif: {
    cameraMake: '',
    cameraModel: '',
    lensModel: '',
    focalLength: '',
    aperture: '',
    shutterSpeed: '',
    iso: null,
    exposureCompensation: '',
    whiteBalance: ''
  },
  exifDetected: false,
  gpsDetected: false,
  exifStatus: 'checking',
  gpsStatus: 'checking',
  expanded: false,
  exifCollapse: [],
  progress: 0,
  status: 'waiting',
  error: ''
});

const loadOptions = async () => {
  const [albumRes, filterRes] = await Promise.all([
    albumApi.list({ pageSize: 100 }),
    photoApi.filterOptions()
  ]);
  albums.value = albumRes.data || [];
  locationOptions.value = filterRes.data || { countries: [], cities: [] };
};

const onFileChange = (file) => {
  if (!file?.raw) return;
  if (file.raw.size > maxBytes.value) {
    ElMessage.warning(`单张图片不能超过 ${settings.settings.uploadMaxSizeMb} MB`);
    return;
  }
  const exists = queueItems.value.some((item) => item.file.uid === file.uid);
  if (!exists) {
    const item = createQueueItem(file);
    queueItems.value.push(item);
    detectQueueMeta(item);
  }
};

const detectQueueMeta = async (item) => {
  try {
    const result = await readJpegExifStatus(item.raw);
    item.exifDetected = Boolean(result.hasExif);
    item.gpsDetected = Boolean(result.hasGps);
    item.exifStatus = result.supported ? (result.hasExif ? 'found' : 'none') : 'unsupported';
    item.gpsStatus = result.supported ? (result.hasGps ? 'found' : 'none') : 'unsupported';
    if (result.cameraMake && !item.exif.cameraMake) item.exif.cameraMake = result.cameraMake;
    if (result.cameraModel && !item.exif.cameraModel) item.exif.cameraModel = result.cameraModel;
    if (Number.isFinite(result.latitude) && !String(item.location.latitude || '').trim()) {
      item.location.latitude = result.latitude.toFixed(6);
    }
    if (Number.isFinite(result.longitude) && !String(item.location.longitude || '').trim()) {
      item.location.longitude = result.longitude.toFixed(6);
    }
  } catch {
    item.exifDetected = false;
    item.gpsDetected = false;
    item.exifStatus = 'none';
    item.gpsStatus = 'none';
  }
};

const revokeItem = (item) => {
  if (item?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
};

const removeItem = (uid) => {
  const item = queueItems.value.find((entry) => entry.uid === uid);
  revokeItem(item);
  queueItems.value = queueItems.value.filter((entry) => entry.uid !== uid);
};

const resetUrlForm = () => {
  Object.assign(urlForm, initialUrlForm());
};

const clear = () => {
  queueItems.value.forEach(revokeItem);
  queueItems.value = [];
  resetUrlForm();
  uploadRef.value?.clearFiles();
};

const hasManualExifMeta = (item) => Object.values(item.exif || {}).some((value) => value !== null && value !== undefined && String(value).trim() !== '');
const hasExifMeta = (item) => Boolean(item.exifDetected || hasManualExifMeta(item));
const hasLocation = (item) => {
  const location = item.location || {};
  return Boolean(item.gpsDetected || ['country', 'city', 'locationName', 'latitude', 'longitude'].some((key) => String(location[key] || '').trim()));
};

const exifStatusLabel = (item) => {
  if (hasManualExifMeta(item)) return 'EXIF 已填';
  if (item.exifDetected) return 'EXIF 有';
  if (item.exifStatus === 'checking') return 'EXIF 检测中';
  if (item.exifStatus === 'unsupported') return 'EXIF 未预读';
  return 'EXIF 无';
};

const locationStatusLabel = (item) => {
  const location = item.location || {};
  const manualLocation = ['country', 'city', 'locationName', 'latitude', 'longitude'].some((key) => String(location[key] || '').trim());
  if (item.gpsDetected) return 'GPS 有';
  if (manualLocation) return '位置已填';
  if (item.gpsStatus === 'checking') return '位置检测中';
  if (item.gpsStatus === 'unsupported') return '位置未预读';
  return '位置无';
};

const statusLabel = (status) => ({
  waiting: '等待上传',
  uploading: '上传中',
  success: '已完成',
  failed: '失败'
}[status] || '等待上传');

const statusTagType = (status) => ({
  waiting: 'info',
  uploading: 'warning',
  success: 'success',
  failed: 'danger'
}[status] || 'info');

const appendPayload = (fd, payload) => {
  Object.entries(payload).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) fd.append(key, value.join(','));
      return;
    }
    if (value !== null && value !== undefined && value !== '') fd.append(key, value);
  });
};

const itemPayload = (item) => ({
  title: item.title || titleFromFile(item.file.name),
  description: item.description,
  albumId: item.albumId,
  visibility: item.visibility,
  tags: item.tags,
  ...item.location,
  ...item.exif
});

const urlPayload = () => {
  const payload = {};
  Object.entries(urlForm).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) payload[key] = value;
      return;
    }
    if (value !== null && value !== undefined && value !== '') payload[key] = value;
  });
  return payload;
};

const submitUrl = async () => {
  if (!urlForm.imageUrl.trim()) {
    ElMessage.warning('请先填写图片 URL');
    return;
  }
  submitting.value = true;
  try {
    const res = await photoApi.createFromUrl(urlPayload());
    ElMessage.success('外链照片已添加');
    emit('uploaded', res.data);
    clear();
  } finally {
    submitting.value = false;
  }
};

const uploadOne = async (item) => {
  const fd = new FormData();
  appendPayload(fd, itemPayload(item));
  fd.append('photo', item.raw);
  item.status = 'uploading';
  item.error = '';
  item.progress = 1;
  try {
    const res = await photoApi.upload(fd, (event) => {
      if (event.total) item.progress = Math.round((event.loaded * 100) / event.total);
    });
    item.progress = 100;
    item.status = 'success';
    return res.data;
  } catch (error) {
    item.status = 'failed';
    item.error = error?.response?.data?.message || error?.message || '上传失败';
    throw error;
  }
};

const submitFile = async () => {
  if (!queueItems.value.length) {
    ElMessage.warning('请先选择照片');
    return;
  }
  submitting.value = true;
  const uploaded = [];
  try {
    for (const item of queueItems.value) {
      if (item.status === 'success') continue;
      uploaded.push(await uploadOne(item));
    }
    ElMessage.success('上传完成');
    emit('uploaded', uploaded);
    clear();
  } catch {
    ElMessage.error('部分照片上传失败，请检查清单中的失败项');
  } finally {
    submitting.value = false;
  }
};

const submit = () => {
  if (uploadMode.value === 'url') return submitUrl();
  return submitFile();
};

onMounted(loadOptions);
onBeforeUnmount(() => queueItems.value.forEach(revokeItem));
</script>

<style scoped>
.upload-panel {
  padding: 18px;
}

.upload-topline {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
}

.upload-topline :deep(.el-form-item) {
  margin-bottom: 0;
}

.upload-note,
.drop-tip {
  margin: 0;
  color: var(--theme-muted-strong);
  font-size: 13px;
  line-height: 1.6;
}

.upload-grid,
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  width: 100%;
}

.upload-panel :deep(.el-select),
.upload-panel :deep(.el-date-editor),
.upload-panel :deep(.el-input-number),
.upload-panel :deep(.el-segmented) {
  width: 100%;
}

.drop-title {
  margin: 12px 0 6px;
  font-weight: 800;
}

.drop-tip {
  width: 100%;
  margin-top: 8px;
}

.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0 12px;
}

.queue-head div {
  display: grid;
  gap: 3px;
}

.queue-head strong {
  color: var(--theme-text);
}

.queue-head span {
  color: var(--theme-muted-strong);
  font-size: 13px;
}

.upload-queue {
  display: grid;
  gap: 12px;
}

.upload-row {
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  background: var(--theme-card-bg);
  overflow: hidden;
}

.upload-row.expanded {
  border-color: color-mix(in srgb, var(--theme-primary) 42%, var(--theme-line));
}

.row-main {
  display: grid;
  grid-template-columns: 98px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
}

.thumb-wrap {
  position: relative;
  width: 98px;
  height: 74px;
  border-radius: var(--theme-card-radius, var(--radius));
  background: var(--theme-surface-soft);
  overflow: hidden;
}

.queue-thumb {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  user-select: none;
}

.queue-thumb {
  border: 1px solid var(--theme-line-soft);
}

.row-fields {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.queue-inline {
  display: grid;
  grid-template-columns: minmax(150px, 260px) minmax(132px, 210px) auto auto auto;
  gap: 8px;
  align-items: center;
}

.queue-title-input :deep(.el-input__wrapper),
.queue-tag-select :deep(.el-select__wrapper) {
  min-height: 32px;
}

.queue-title-input :deep(.el-input__inner),
.queue-tag-select :deep(.el-select__placeholder),
.queue-tag-select :deep(.el-select__selected-item) {
  font-size: 13px;
}

.meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--theme-muted-strong);
  font-size: 12px;
}

.meta-line span,
.meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 3px 8px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 999px;
  background: var(--theme-surface-soft);
  line-height: 1;
  white-space: nowrap;
}

.meta-pill {
  justify-content: center;
  color: var(--theme-muted-strong);
  font-size: 12px;
  font-weight: 700;
}

.meta-line .ready,
.meta-pill.ready {
  color: var(--theme-tag-text);
  border-color: var(--theme-tag-border);
  background: var(--theme-tag-bg);
}

.meta-pill.checking {
  color: var(--theme-primary);
  border-color: color-mix(in srgb, var(--theme-primary) 34%, var(--theme-line));
}

.row-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.row-actions :deep(.el-button),
.queue-head :deep(.el-button),
.upload-actions :deep(.el-button) {
  min-height: 32px;
  border-radius: var(--theme-control-radius, var(--radius));
  font-weight: 700;
}

.row-error {
  margin: 0;
  color: var(--theme-danger-text);
  font-size: 13px;
}

.row-detail {
  padding: 12px;
  border-top: 1px solid var(--theme-line);
  background: var(--theme-surface-glass);
}

.meta-collapse {
  margin-top: 4px;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  background: var(--theme-surface-soft);
  overflow: hidden;
}

.meta-collapse :deep(.el-collapse-item__header) {
  min-height: 46px;
  padding: 0 12px;
  border-bottom: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius)) !important;
  color: var(--theme-text);
  background: transparent;
}

.meta-collapse :deep(.el-collapse-item__header.is-active) {
  border-radius: var(--theme-card-radius, var(--radius)) var(--theme-card-radius, var(--radius)) 0 0 !important;
}

.meta-collapse :deep(.el-collapse-item__wrap),
.meta-collapse :deep(.el-collapse-item__content) {
  border-radius: 0 0 var(--theme-card-radius, var(--radius)) var(--theme-card-radius, var(--radius)) !important;
  color: var(--theme-text);
  background: transparent;
  overflow: hidden;
}

.meta-collapse :deep(.el-collapse-item__content) {
  padding: 12px;
}

.collapse-title {
  font-weight: 800;
  color: var(--theme-text);
}

.collapse-subtitle {
  margin-left: 10px;
  color: var(--theme-muted-strong);
  font-size: 12px;
}

.url-preview {
  display: block;
  max-width: min(100%, 520px);
  max-height: 320px;
  margin-top: 6px;
  border: 1px solid var(--theme-line);
  border-radius: var(--theme-card-radius, var(--radius));
  object-fit: contain;
  background: var(--theme-surface-soft);
}

.upload-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.queue-detail-enter-active,
.queue-detail-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.queue-detail-enter-from,
.queue-detail-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 780px) {
  .upload-topline,
  .queue-head {
    align-items: stretch;
    flex-direction: column;
  }

  .row-main {
    grid-template-columns: 82px minmax(0, 1fr);
  }

  .thumb-wrap {
    width: 82px;
    height: 64px;
  }

  .row-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }

  .queue-inline {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 1fr);
  }

  .queue-inline .el-tag,
  .queue-inline .meta-pill {
    justify-self: start;
  }
}
</style>
