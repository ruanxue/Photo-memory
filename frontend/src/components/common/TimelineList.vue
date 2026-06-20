<template>
  <div class="timeline-list">
    <section v-for="year in timeline" :key="year.year" class="year-block">
      <h2>{{ year.year }}</h2>
      <div v-for="month in year.months" :key="month.month" class="month-block">
        <h3>{{ String(month.month).padStart(2, '0') }}月</h3>
        <article v-for="day in month.days" :key="day.day" class="day-card">
          <div class="day">{{ day.day }}</div>
          <div>
            <h4>{{ day.title }}</h4>
            <p>{{ day.description || day.city || '这一天留下了一组照片。' }}</p>
            <router-link :to="dayPhotosTo(day)">{{ day.count }} 张照片</router-link>
          </div>
          <div class="day-photos">
            <router-link v-for="photo in day.photos.slice(0, 4)" :key="photo.id" :to="dayPhotosTo(day)" class="timeline-photo-link">
              <img :src="photo.thumbnailUrl" :alt="photo.title" />
            </router-link>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  timeline: { type: Array, default: () => [] }
});

const dayPhotosTo = (day) => ({
  path: '/photos',
  query: day.city ? { city: day.city } : {}
});
</script>

<style scoped>
.timeline-list {
  display: grid;
  gap: 28px;
}

.year-block h2 {
  font-size: 42px;
  margin: 0 0 16px;
}

.month-block {
  border-left: 2px solid var(--theme-line);
  padding-left: 22px;
  margin-left: 18px;
}

.month-block h3 {
  color: var(--theme-muted-strong);
}

.day-card {
  display: grid;
  grid-template-columns: 54px 1fr 260px;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--theme-line);
  transition: border-color 0.22s ease;
}

.day {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--theme-primary-soft);
  color: var(--theme-primary-strong);
  border: 1px solid var(--theme-tag-border);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--theme-primary) 18%, transparent);
  display: grid;
  place-items: center;
  font-weight: 800;
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    color 0.22s ease,
    box-shadow 0.22s ease;
}

.day-card:hover {
  border-color: var(--theme-button-hover-border);
}

.day-card:hover .day {
  background: var(--theme-control-selected-bg);
  border-color: var(--theme-control-selected-border);
  color: var(--theme-control-selected-text);
  box-shadow: 0 14px 32px color-mix(in srgb, var(--theme-primary) 26%, transparent);
}

h4 {
  margin: 0 0 8px;
}

p {
  margin: 0 0 8px;
  color: var(--theme-muted-strong);
}

a {
  color: var(--theme-primary-strong);
  font-weight: 600;
}

.day-photos {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.day-photos img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
}

@media (max-width: 760px) {
  .day-card {
    grid-template-columns: 44px 1fr;
  }

  .day-photos {
    grid-column: 2;
  }
}
</style>
