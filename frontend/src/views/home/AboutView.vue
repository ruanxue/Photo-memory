<template>
  <section class="page-hero container">
    <h1>关于</h1>
    <p>这是一个用于保存旅行、生活和摄影作品的私人影像网站。</p>
  </section>
  <section class="section">
    <div class="container about-grid">
      <article class="surface">
        <h2>网站介绍</h2>
        <p>Photo Memory 用瀑布流、相册、时间轴和地图组织照片，让照片不仅被展示，也能被重新检索、回忆和讲述。</p>
      </article>
      <article class="surface">
        <h2>作者与设备</h2>
        <p>这里可以填写作者介绍、常用相机、镜头、手机、胶片机和旅行偏好。系统设置页可维护网站名称、副标题、页脚版权等信息。</p>
      </article>
      <article class="surface">
        <h2>版权声明</h2>
        <p>所有照片默认归作者所有，未经允许禁止商用。可按需配置 CC BY-NC-ND 等协议。请勿盗图、二改或用于训练素材库。</p>
      </article>
      <article class="surface">
        <h2>联系方式</h2>
        <p>可在此处填写邮箱、社交账号、摄影主页或合作说明。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.about-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

article {
  padding: 24px;
}

p {
  color: var(--theme-muted-strong);
  line-height: 1.8;
}
</style>
