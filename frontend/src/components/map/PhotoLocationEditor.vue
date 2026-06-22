<template>
  <div class="photo-location-editor">
    <div v-if="collapsible" class="location-summary">
      <div>
        <strong>{{ locationSummary }}</strong>
        <span>{{ coordinateSummary }}</span>
      </div>
      <el-button size="small" @click="toolsVisible = !toolsVisible">
        {{ toolsVisible ? '收起选点' : '编辑位置' }}
      </el-button>
    </div>

    <div v-show="!collapsible || toolsVisible" class="location-tools">
    <div class="location-search-row">
      <el-input
        v-model="searchKeyword"
        clearable
        placeholder="搜索地点，例如：九眼桥、独克宗古城"
        @keyup.enter="searchPlaces"
      >
        <template #append>
          <el-button :loading="searching" @click="searchPlaces">搜索</el-button>
        </template>
      </el-input>
      <el-button @click="openPicker">地图选点</el-button>
      <el-button :loading="reversing" @click="reverseCurrent">自动识别位置</el-button>
    </div>

    <div v-if="placeResults.length" class="place-results">
      <button
        v-for="place in placeResults"
        :key="`${place.uid || place.name}-${place.latitude}-${place.longitude}`"
        type="button"
        @click="selectPlace(place)"
      >
        <strong>{{ place.name || place.locationName }}</strong>
        <span>{{ [place.country, place.province, place.city, place.district, place.address].filter(Boolean).join(' · ') }}</span>
      </button>
    </div>

    <div class="location-field-grid">
      <el-select
        :model-value="model.country"
        filterable
        allow-create
        default-first-option
        clearable
        placeholder="国家 / 地区"
        @update:model-value="updateField('country', $event)"
      >
        <el-option v-for="item in countryOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select
        :model-value="model.city"
        filterable
        allow-create
        default-first-option
        clearable
        placeholder="城市"
        @update:model-value="updateField('city', $event)"
      >
        <el-option v-for="item in cityOptions" :key="item.key" :label="item.label" :value="item.value" />
      </el-select>
      <el-input :model-value="model.locationName" clearable placeholder="地点名称" @update:model-value="updateField('locationName', $event)" />
      <el-input :model-value="model.latitude" clearable placeholder="纬度" @update:model-value="updateField('latitude', $event)" />
      <el-input :model-value="model.longitude" clearable placeholder="经度" @update:model-value="updateField('longitude', $event)" />
      <el-button @click="clearLocation">清除位置</el-button>
    </div>

    <p class="location-help">
      可手动输入，也可搜索地点或在地图上选点。自动识别依赖后台配置的百度地图服务端 AK。
    </p>
    </div>

    <el-dialog
      v-model="pickerVisible"
      title="地图选择拍摄地"
      width="860px"
      append-to-body
      destroy-on-close
      @opened="refreshPicker"
    >
      <LocationPickerMap
        ref="pickerRef"
        :latitude="pickerDraft.latitude"
        :longitude="pickerDraft.longitude"
        :country="pickerDraft.country"
        @select="updatePickerDraft"
      />
      <template #footer>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" @click="applyPickerDraft">使用坐标</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { mapApi } from '../../api/map.api.js';
import { photoApi } from '../../api/photo.api.js';
import LocationPickerMap from './LocationPickerMap.vue';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  locationOptions: { type: Object, default: () => ({ countries: [], cities: [] }) },
  collapsible: { type: Boolean, default: false },
  initialOpen: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue']);

const internalOptions = ref({ countries: [], cities: [] });
const searchKeyword = ref('');
const searching = ref(false);
const reversing = ref(false);
const placeResults = ref([]);
const pickerVisible = ref(false);
const pickerRef = ref(null);
const toolsVisible = ref(props.initialOpen);
const pickerDraft = reactive({ latitude: '', longitude: '', country: '', city: '', locationName: '' });

const model = computed(() => ({
  country: props.modelValue?.country ?? '',
  city: props.modelValue?.city ?? '',
  locationName: props.modelValue?.locationName ?? '',
  latitude: props.modelValue?.latitude ?? '',
  longitude: props.modelValue?.longitude ?? ''
}));

const options = computed(() => {
  const provided = props.locationOptions || {};
  if ((provided.countries || []).length || (provided.cities || []).length) return provided;
  return internalOptions.value;
});

const locationSummary = computed(() => {
  const parts = [model.value.country, model.value.city, model.value.locationName].filter(Boolean);
  return parts.length ? parts.join(' · ') : '暂无拍摄地点';
});

const coordinateSummary = computed(() => {
  const lat = Number(model.value.latitude);
  const lng = Number(model.value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '未填写经纬度';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
});

const withCurrentCountry = computed(() => {
  const items = [...(options.value.countries || [])];
  if (model.value.country && !items.some((item) => item.country === model.value.country)) {
    items.unshift({ country: model.value.country, count: 0 });
  }
  return items;
});

const countryOptions = computed(() => withCurrentCountry.value
  .filter((item) => item.country)
  .map((item) => ({
    value: item.country,
    label: item.count ? `${item.country} (${item.count})` : item.country
  })));

const cityOptions = computed(() => {
  const items = [...(options.value.cities || [])];
  if (model.value.city && !items.some((item) => item.city === model.value.city && (!model.value.country || item.country === model.value.country))) {
    items.unshift({ country: model.value.country || '', city: model.value.city, count: 0 });
  }
  return items
    .filter((item) => !model.value.country || item.country === model.value.country)
    .filter((item) => item.city)
    .map((item) => ({
      key: `${item.country || 'unknown'}-${item.city}`,
      value: item.city,
      label: item.count ? `${item.city} (${item.count})` : item.city
    }));
});

const updateValue = (patch) => {
  emit('update:modelValue', { ...model.value, ...patch });
};

const updateField = (field, value) => {
  updateValue({ [field]: value ?? '' });
};

const applyPlace = (place) => {
  updateValue({
    country: place.country || model.value.country || '',
    city: place.city || model.value.city || '',
    locationName: place.locationName || place.name || model.value.locationName || '',
    latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude).toFixed(6) : model.value.latitude,
    longitude: Number.isFinite(Number(place.longitude)) ? Number(place.longitude).toFixed(6) : model.value.longitude
  });
};

const searchPlaces = async () => {
  const q = searchKeyword.value.trim();
  if (!q) {
    ElMessage.warning('请输入地点关键词');
    return;
  }
  searching.value = true;
  try {
    const res = await mapApi.places({
      q,
      country: model.value.country || undefined,
      city: model.value.city || undefined,
      lat: model.value.latitude || undefined,
      lng: model.value.longitude || undefined
    });
    placeResults.value = res.data || [];
    if (!placeResults.value.length) ElMessage.info('没有找到匹配地点');
  } finally {
    searching.value = false;
  }
};

const selectPlace = (place) => {
  applyPlace(place);
  placeResults.value = [];
};

const reverseCoordinates = async ({ latitude, longitude }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const res = await mapApi.reverseGeocode({ lat, lng });
  return res.data;
};

const reverseCurrent = async () => {
  if (!model.value.latitude || !model.value.longitude) {
    ElMessage.warning('请先填写或选择经纬度');
    return;
  }
  reversing.value = true;
  try {
    const place = await reverseCoordinates(model.value);
    if (place) applyPlace(place);
  } finally {
    reversing.value = false;
  }
};

const clearLocation = () => {
  updateValue({ country: '', city: '', locationName: '', latitude: '', longitude: '' });
  placeResults.value = [];
};

const openPicker = async () => {
  Object.assign(pickerDraft, model.value);
  pickerVisible.value = true;
  await nextTick();
  refreshPicker();
};

const refreshPicker = () => {
  pickerRef.value?.refresh?.();
};

const updatePickerDraft = async ({ latitude, longitude, country, city, locationName }) => {
  pickerDraft.latitude = latitude ?? pickerDraft.latitude;
  pickerDraft.longitude = longitude ?? pickerDraft.longitude;
  if (country !== undefined) pickerDraft.country = country || '';
  if (city !== undefined) pickerDraft.city = city || '';
  if (locationName !== undefined) pickerDraft.locationName = locationName || '';
  try {
    const place = await reverseCoordinates(pickerDraft);
    if (place) {
      pickerDraft.country = place.country || pickerDraft.country || '';
      pickerDraft.city = place.city || pickerDraft.city || '';
      pickerDraft.locationName = place.locationName || pickerDraft.locationName || '';
    }
  } catch {
    // Coordinates remain usable even when reverse geocoding is unavailable.
  }
};

const applyPickerDraft = () => {
  const lat = Number(pickerDraft.latitude);
  const lng = Number(pickerDraft.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    ElMessage.warning('请先在地图上选择拍摄地');
    return;
  }
  updateValue({
    country: pickerDraft.country || model.value.country || '',
    city: pickerDraft.city || model.value.city || '',
    locationName: pickerDraft.locationName || model.value.locationName || '',
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6)
  });
  pickerVisible.value = false;
};

watch(() => model.value.country, (country, previous) => {
  if (country === previous || !model.value.city) return;
  const selectedCity = (options.value.cities || []).find((item) => item.city === model.value.city);
  if (selectedCity && selectedCity.country && selectedCity.country !== country) {
    updateValue({ city: '' });
  }
});

onMounted(async () => {
  if ((props.locationOptions?.countries || []).length || (props.locationOptions?.cities || []).length) return;
  try {
    const res = await photoApi.filterOptions();
    internalOptions.value = res.data || { countries: [], cities: [] };
  } catch {
    internalOptions.value = { countries: [], cities: [] };
  }
});
</script>

<style scoped>
.photo-location-editor {
  display: grid;
  gap: 10px;
  width: 100%;
}

.location-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  background: var(--theme-surface-soft);
}

.location-summary div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.location-summary strong {
  color: var(--theme-text);
  font-size: 14px;
  line-height: 1.4;
}

.location-summary span {
  color: var(--theme-muted-strong);
  font-size: 12px;
}

.location-tools {
  display: grid;
  gap: 10px;
}

.location-search-row,
.location-field-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) repeat(2, auto);
  gap: 10px;
  align-items: center;
}

.location-field-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.place-results {
  display: grid;
  gap: 6px;
  max-height: 210px;
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--theme-line);
  border-radius: var(--radius);
  background: var(--theme-surface-soft);
}

.place-results button {
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: calc(var(--radius) - 1px);
  color: var(--theme-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.place-results button:hover,
.place-results button:focus-visible {
  border-color: var(--theme-primary);
  background: var(--theme-button-hover-bg);
  outline: none;
}

.place-results span,
.location-help {
  color: var(--theme-muted-strong);
  font-size: 12px;
  line-height: 1.6;
}

.location-help {
  margin: 0;
}

@media (max-width: 720px) {
  .location-search-row {
    grid-template-columns: 1fr;
  }
}
</style>
