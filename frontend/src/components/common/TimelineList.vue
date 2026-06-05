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
            <router-link :to="{ path: '/photos', query: { city: day.city } }">{{ day.count }} 张照片</router-link>
          </div>
          <div class="day-photos">
            <router-link v-for="photo in day.photos.slice(0, 4)" :key="photo.id" :to="`/photos/${photo.id}`">
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
  border-left: 2px solid var(--line);
  padding-left: 22px;
  margin-left: 18px;
}

.month-block h3 {
  color: var(--muted-strong);
}

.day-card {
  display: grid;
  grid-template-columns: 54px 1fr 260px;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.day {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--text);
  color: var(--page-bg);
  display: grid;
  place-items: center;
  font-weight: 800;
}

h4 {
  margin: 0 0 8px;
}

p {
  margin: 0 0 8px;
  color: var(--muted-strong);
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
