<template>
  <main class="album-roll-page" :class="{ 'is-fetching': isFetching }" :style="rollStyle">
    <template v-if="albums.length">
      <header class="roll-nav" aria-label="相册章节导航">
        <span>PHOTO MEMORY JOURNAL</span>
        <div class="roll-progress" aria-hidden="true">
          <button
            v-for="(album, index) in albums"
            :key="album.id"
            class="progress-cell"
            :class="{ active: index === activeIndex }"
            type="button"
            @mouseenter="setActive(index)"
            @focus="setActive(index)"
            @click="openAlbum(album)"
          />
        </div>
        <span>ROLL {{ pad(activeIndex + 1) }} COVER</span>
      </header>

      <section class="roll-stage">
        <div class="roll-copy">
          <p class="kicker">A PHOTOGRAPHIC ALBUM JOURNAL · {{ activeLocation }}</p>
          <h1>
            <span>{{ activeTitle }}</span>
            <strong>{{ activeYear }}</strong>
          </h1>
          <div class="accent-line" />
          <p class="date-line">{{ activeDate }} · {{ activeLocation }}</p>
          <p class="description">{{ activeAlbum.description || '一组被整理进章节里的照片，保留当时的光、地点和心情。' }}</p>

          <div class="chapter-table" role="list" aria-label="相册目录">
            <button
              v-for="(album, index) in albums"
              :key="album.id"
              class="chapter-row"
              :class="{ active: index === activeIndex }"
              type="button"
              role="listitem"
              @mouseenter="setActive(index)"
              @focus="setActive(index)"
              @click="openAlbum(album)"
            >
              <span>{{ pad(index + 1) }}</span>
              <span>{{ shortDate(album) }}</span>
              <strong>{{ album.title }}</strong>
              <em>{{ albumLocation(album) }}</em>
            </button>
          </div>

          <button class="enter-roll" type="button" @click="openAlbum(activeAlbum)">
            <span>ENTER ROLL</span>
          </button>
        </div>

        <div class="roll-sidecode" aria-hidden="true">
          PHOTO MEMORY · ALBUM INDEX · {{ activeDate }}
        </div>

        <div class="album-strip" aria-label="相册卡片">
          <button
            v-for="(album, index) in albums"
            :key="album.id"
            class="strip-card"
            :class="{ active: index === activeIndex }"
            :style="{ '--card-accent': palette[index % palette.length] }"
            type="button"
            @mouseenter="setActive(index)"
            @focus="setActive(index)"
            @click="openAlbum(album)"
          >
            <img
              :src="albumCover(album)"
              :srcset="albumCoverSrcset(album) || undefined"
              :sizes="photoImageSizes.album"
              :alt="album.title"
              loading="lazy"
              @error="handleImageError"
            />
            <span class="card-index">{{ pad(index + 1) }}</span>
            <span class="card-date">EXP {{ shortDate(album) }}</span>
            <strong>{{ album.title }}</strong>
            <em>{{ album.photoCount || album.photos?.length || 0 }} PHOTOS</em>
          </button>
        </div>
      </section>
    </template>

    <div v-else-if="isFetching" class="album-roll-placeholder" aria-hidden="true" />
    <EmptyState v-else class="album-empty" title="暂无相册" description="创建相册后会出现在这里。" />
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { albumApi } from '../../api/album.api.js';
import EmptyState from '../../components/common/EmptyState.vue';
import { readAlbumListPreview, rememberAlbumListPreview, rememberAlbumPreview } from '../../utils/albumPreviewCache.js';
import { albumCover, albumCoverSrcset, handleImageError, photoImageSizes } from '../../utils/image.js';
import { formatDate } from '../../utils/format.js';

const router = useRouter();
const albums = ref(readAlbumListPreview());
const isFetching = ref(false);
const activeIndex = ref(0);

const palette = ['#d64a38', '#168c98', '#55723b', '#b16a3f', '#263d73', '#d6ad4a', '#9b4859'];

const pad = (value) => String(value).padStart(2, '0');

const dateValue = (album) => album.startDate || album.coverPhoto?.takenAt || album.photos?.[0]?.takenAt || album.createdAt;
const yearText = (album) => {
  const date = new Date(dateValue(album));
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
};
const shortDate = (album) => {
  const date = new Date(dateValue(album));
  if (Number.isNaN(date.getTime())) return '--.--';
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};
const albumLocation = (album) => {
  const photo = album.coverPhoto || album.photos?.[0] || {};
  return photo.city || photo.locationName || photo.province || photo.country || 'MEMORY';
};

const activeAlbum = computed(() => albums.value[activeIndex.value] || albums.value[0] || {});
const activeTitle = computed(() => activeAlbum.value.title || 'ALBUM');
const activeYear = computed(() => yearText(activeAlbum.value));
const activeDate = computed(() => formatDate(dateValue(activeAlbum.value), '未知日期'));
const activeLocation = computed(() => albumLocation(activeAlbum.value));
const rollStyle = computed(() => ({
  '--roll-accent': palette[activeIndex.value % palette.length]
}));

const setActive = (index) => {
  activeIndex.value = index;
};

const openAlbum = (album) => {
  if (!album?.id) return;
  const preview = rememberAlbumPreview(album);
  router.push({
    name: 'album-detail',
    params: { id: album.id },
    state: preview ? { albumPreview: preview } : {}
  });
};

onMounted(async () => {
  isFetching.value = true;
  try {
    const res = await albumApi.list({ pageSize: 60 });
    albums.value = res.data || [];
    rememberAlbumListPreview(albums.value);
    if (activeIndex.value >= albums.value.length) activeIndex.value = 0;
  } finally {
    isFetching.value = false;
  }
});
</script>

<style scoped>
.album-roll-page {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  padding: clamp(18px, 2.2vw, 30px);
  color: #f4ead7;
  background:
    linear-gradient(90deg, rgba(5, 5, 4, 0.98), rgba(9, 10, 9, 0.9) 42%, rgba(4, 4, 4, 0.98)),
    var(--theme-page-bg);
  isolation: isolate;
}

.album-roll-page::before,
.album-roll-page::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: -1;
}

.album-roll-page::before {
  background:
    linear-gradient(180deg, transparent 0 52%, color-mix(in srgb, var(--roll-accent) 42%, transparent) 100%),
    radial-gradient(circle at 18% 88%, color-mix(in srgb, var(--roll-accent) 38%, transparent), transparent 34%);
  opacity: 0.82;
  transition: background 0.38s ease;
}

.album-roll-page::after {
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 4px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035), transparent 24%, transparent 76%, rgba(255, 255, 255, 0.03));
  mix-blend-mode: screen;
  opacity: 0.32;
}

.album-empty {
  width: min(820px, 100%);
  margin: 22dvh auto 0;
}

.album-roll-placeholder {
  min-height: calc(100dvh - 60px);
}

.roll-nav {
  width: min(100%, 1720px);
  height: 34px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto minmax(180px, 1fr);
  align-items: center;
  gap: 18px;
  color: rgba(244, 234, 215, 0.54);
  font-family: "Courier New", monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.roll-nav span:last-child {
  text-align: right;
}

.roll-progress {
  display: flex;
  align-items: center;
  gap: 7px;
}

.progress-cell {
  width: clamp(16px, 1.8vw, 28px);
  height: 8px;
  padding: 0;
  border: 1px solid rgba(244, 234, 215, 0.13);
  border-radius: 1px;
  background: rgba(244, 234, 215, 0.18);
  cursor: pointer;
  transition: width 0.24s ease, background 0.24s ease, border-color 0.24s ease;
}

.progress-cell.active {
  width: clamp(30px, 3vw, 48px);
  border-color: var(--roll-accent);
  background: var(--roll-accent);
}

.roll-stage {
  width: min(100%, 1720px);
  min-height: calc(100dvh - 82px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(330px, 0.72fr) minmax(18px, 34px) minmax(520px, 1.18fr);
  align-items: center;
  gap: clamp(18px, 2.3vw, 36px);
  padding-top: clamp(10px, 2.8vh, 28px);
}

.roll-copy {
  max-width: 620px;
  padding-left: clamp(4px, 1vw, 18px);
}

.kicker,
.date-line,
.description,
.chapter-row,
.card-date,
.strip-card em,
.enter-roll,
.roll-sidecode {
  font-family: "Courier New", monospace;
}

.kicker {
  margin: 0 0 18px;
  color: rgba(244, 234, 215, 0.68);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  line-height: 0.9;
  text-transform: uppercase;
}

h1 span,
h1 strong {
  display: block;
  letter-spacing: 0;
}

h1 span {
  max-width: min(8.6ch, 100%);
  overflow-wrap: anywhere;
  color: #f7ecd6;
  font-size: clamp(56px, 8.2vw, 132px);
  font-weight: 950;
}

h1 strong {
  margin-top: 6px;
  color: transparent;
  -webkit-text-stroke: clamp(1px, 0.16vw, 2px) color-mix(in srgb, var(--roll-accent) 76%, #f7ecd6);
  font-size: clamp(54px, 7.2vw, 118px);
  font-weight: 900;
}

.accent-line {
  width: min(330px, 64%);
  height: 4px;
  margin: clamp(18px, 3vh, 30px) 0 12px;
  background: var(--roll-accent);
  box-shadow: 0 0 28px color-mix(in srgb, var(--roll-accent) 42%, transparent);
}

.date-line {
  margin: 0;
  color: rgba(244, 234, 215, 0.76);
  font-size: 13px;
  font-weight: 900;
}

.description {
  max-width: 390px;
  min-height: 42px;
  margin: 14px 0 26px;
  color: color-mix(in srgb, var(--roll-accent) 70%, #f7ecd6);
  font-size: 12px;
  font-style: italic;
  font-weight: 800;
  line-height: 1.65;
}

.chapter-table {
  width: min(520px, 100%);
  display: grid;
  border-top: 1px solid rgba(244, 234, 215, 0.13);
}

.chapter-row {
  display: grid;
  grid-template-columns: 34px 64px minmax(0, 1fr) 88px;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding: 0 10px 0 0;
  border: 0;
  border-bottom: 1px solid rgba(244, 234, 215, 0.1);
  color: rgba(244, 234, 215, 0.58);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: left;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.chapter-row strong,
.chapter-row em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-row em {
  text-align: right;
  font-style: normal;
}

.chapter-row:hover,
.chapter-row:focus-visible,
.chapter-row.active {
  color: #fff6e7;
  background: linear-gradient(90deg, color-mix(in srgb, var(--roll-accent) 52%, transparent), transparent);
  transform: translateX(5px);
}

.enter-roll {
  min-width: 150px;
  margin-top: 22px;
  padding: 12px 20px;
  border: 1px solid color-mix(in srgb, var(--roll-accent) 70%, #f7ecd6);
  border-radius: 2px;
  color: #f7ecd6;
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.16em;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.enter-roll:hover,
.enter-roll:focus-visible {
  color: #100e0c;
  background: var(--roll-accent);
  transform: translateY(-2px);
}

.roll-sidecode {
  justify-self: center;
  writing-mode: vertical-rl;
  color: rgba(244, 234, 215, 0.26);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.album-strip {
  width: 100%;
  max-width: 960px;
  justify-self: end;
  display: grid;
  align-content: center;
  gap: clamp(7px, 1vh, 10px);
  padding: 8px;
  border: 1px solid rgba(244, 234, 215, 0.1);
  background: rgba(0, 0, 0, 0.22);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.62), 0 30px 90px rgba(0, 0, 0, 0.34);
}

.strip-card {
  position: relative;
  height: clamp(68px, 9.2vh, 92px);
  overflow: hidden;
  padding: 0;
  border: 1px solid rgba(244, 234, 215, 0.08);
  border-radius: 1px;
  color: #f7ecd6;
  background: #101010;
  cursor: pointer;
  text-align: left;
  filter: saturate(0.35) brightness(0.64);
  transform-origin: center;
  transition: height 0.28s ease, filter 0.28s ease, border-color 0.28s ease, transform 0.28s ease;
}

.strip-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.12) 42%, rgba(0, 0, 0, 0.58));
  pointer-events: none;
}

.strip-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.03);
  transition: transform 0.34s ease;
}

.strip-card.active,
.strip-card:hover,
.strip-card:focus-visible {
  height: clamp(92px, 12vh, 122px);
  border-color: var(--card-accent);
  filter: saturate(1.08) brightness(0.98);
  transform: translateX(-12px);
  z-index: 2;
}

.strip-card.active img,
.strip-card:hover img,
.strip-card:focus-visible img {
  transform: scale(1.08);
}

.card-index,
.card-date,
.strip-card strong,
.strip-card em {
  position: absolute;
  z-index: 1;
  text-shadow: 0 3px 18px rgba(0, 0, 0, 0.72);
}

.card-index {
  top: 8px;
  left: 12px;
  color: var(--card-accent);
  font-size: clamp(22px, 2.6vw, 34px);
  font-weight: 950;
  line-height: 1;
}

.card-date {
  bottom: 10px;
  left: 14px;
  color: rgba(244, 234, 215, 0.58);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.strip-card strong {
  right: 18px;
  top: 50%;
  max-width: 62%;
  overflow: hidden;
  color: rgba(247, 236, 214, 0.84);
  font-size: clamp(18px, 2.4vw, 30px);
  font-weight: 950;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  transform: translateY(-50%);
}

.strip-card em {
  right: 18px;
  bottom: 10px;
  color: rgba(244, 234, 215, 0.48);
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.12em;
}

@media (min-width: 1200px) and (min-aspect-ratio: 16/9) {
  .roll-stage {
    min-height: calc(100dvh - 62px);
    padding-top: 0;
  }

  .kicker {
    margin-bottom: 12px;
  }

  .description {
    min-height: auto;
    margin: 10px 0 18px;
  }

  .accent-line {
    margin-block: clamp(14px, 2.4vh, 22px) 10px;
  }

  .enter-roll {
    margin-top: 16px;
  }

  .strip-card {
    height: clamp(62px, 8.4vh, 84px);
  }

  .strip-card.active,
  .strip-card:hover,
  .strip-card:focus-visible {
    height: clamp(84px, 10.8vh, 108px);
  }
}

@media (max-width: 980px) {
  .album-roll-page {
    min-height: 100%;
    overflow: visible;
  }

  .roll-nav {
    grid-template-columns: 1fr;
    height: auto;
  }

  .roll-nav span:last-child {
    display: none;
  }

  .roll-progress {
    order: 2;
    flex-wrap: wrap;
  }

  .roll-stage {
    min-height: auto;
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 34px 0 80px;
  }

  .roll-sidecode {
    display: none;
  }

  .roll-copy {
    max-width: none;
    padding-left: 0;
  }

  .album-strip {
    align-content: start;
  }

  .strip-card,
  .strip-card.active,
  .strip-card:hover,
  .strip-card:focus-visible {
    height: 96px;
    transform: none;
  }
}

@media (max-width: 620px) {
  .album-roll-page {
    padding: 14px;
  }

  h1 span {
    font-size: clamp(46px, 18vw, 76px);
  }

  h1 strong {
    font-size: clamp(48px, 17vw, 78px);
  }

  .chapter-row {
    grid-template-columns: 30px 54px minmax(0, 1fr);
  }

  .chapter-row em {
    display: none;
  }

  .strip-card strong {
    max-width: 56%;
    font-size: 20px;
  }
}
</style>
