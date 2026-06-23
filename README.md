# 风经过的地方 / Photo Memory

一个面向个人旅行、生活、写真和摄影记录的照片展示网站。项目以“照片本身”为中心，提供首页主图、瀑布流照片墙、相册、时间轴、地图、照片详情、访客评论、后台管理和 Docker 单容器部署能力。

> 把走过的路、爱过的人，和那些不肯散场的光，慢慢收起来。

最后更新：2026-06-23

## 技术栈

前端：

- Vue 3 + Vite
- Vue Router
- Pinia
- Axios
- Element Plus
- Leaflet
- 百度地图 JSAPI GL
- GSAP
- CSS Columns / 自定义瀑布流布局

后端：

- Node.js
- Express
- Prisma ORM
- SQLite
- JWT
- bcryptjs
- multer 2.x
- sharp
- exifr
- helmet
- express-rate-limit

部署：

- 本地开发：前后端分离运行，Vite 代理 `/api` 和 `/uploads`
- 生产部署：Docker 单容器，Express 同时提供前端静态文件、API、上传资源和 SQLite 数据访问
- 反向代理：推荐 Lucky / Nginx / Caddy 只反代容器一个端口

## 当前功能概览

### 公开前台

- 首页 Hero 主图可由后台选择公开照片，支持随机或固定展示。
- 首页瀑布流支持照片和相册混排。
- 照片墙 `/photos` 只展示照片，不混入相册卡片。
- 相册页、相册详情页、时间轴、地图页、关于页。
- 照片详情支持大图、描述、标签、作者、收藏、评论、EXIF 和地理位置。
- 无 EXIF 的照片不会显示照片参数区；无 GPS 的照片不会显示地图区。
- 鼠标右键菜单已全站禁用。
- `map`、`albums`、`timeline`、`photos` 页面不显示公共页脚，减少重复收尾信息。

### 瀑布流与排序

- 首页瀑布流由后台“瀑布流排序”页面集中控制。
- 排序页面中的列表顺序就是首页瀑布流从左到右、从上到下读取的顺序。
- 置顶只对首页瀑布流中出现的照片卡片和相册卡片生效。
- 精选只用于展示照片卡片上的精选标记，不参与排序。
- 归档进相册的照片默认不单独出现在首页瀑布流。
- 相册内照片可在相册编辑页排序；第一张照片默认作为相册卡片头图。
- 相册内单张照片可以设置为“单独展示”，从而作为独立照片卡片进入首页瀑布流。
- 相册私密时，游客看不到相册卡片，也看不到相册内照片。
- 照片私密时，游客在照片墙、相册、时间轴、地图和详情页都不可见。

### 上传与外链图片

- 支持本地单张/批量上传。
- 支持拖拽选择。
- 上传清单按列表显示，默认读取文件名作为照片标题。
- 本地图片会读取 EXIF、GPS、拍摄时间、相机、镜头、尺寸等信息。
- 上传前可以编辑标题、标签、相册、地点和 EXIF。
- 标签为可选项，不再手动输入逗号文本。
- 支持填写图片 URL 添加外链照片。
- 外链照片不会下载到服务器，前台直接从图床加载，适合节省服务器流量。
- 外链照片可编辑 `originalUrl`、`mediumUrl`、`thumbnailUrl`。
- 本地上传会保存原图，并使用 sharp 生成中图和缩略图。

### 地图能力

- 地图页支持百度地图 JSAPI GL、高德瓦片、OpenStreetMap 和自定义 HTTPS 瓦片源。
- 后台可填写百度地图 Web 端 AK 和服务端 AK。
- Web 端 AK 用于前端地图展示，属于公开信息。
- Server AK 只在后端调用，不会通过 `/api/settings` 暴露。
- 支持百度地点搜索、地理编码和逆地理编码。
- 后台编辑照片、用户上传照片、地图选点都可以使用地点搜索和自动回填。
- 数据库统一保存 WGS84 经纬度；百度地图渲染时在前端转换为 BD09。
- 地图页照片卡片点击后，地图跳转到拍摄位置。
- 地图 marker 悬浮显示照片卡片，点击卡片从底部弹出照片详情。

### 评论与收藏

- 点赞系统已经移除。
- 登录用户可以收藏照片。
- 游客可以发表评论，但需要填写用户名和邮箱。
- 游客邮箱只在后台评论管理可见，前台不展示。
- 同一访客在一个评论区填写过用户名和邮箱后，前端会复用到其他照片评论区。
- 评论审核可在后台开关控制。
- 评论管理中状态按钮已合并：点击状态按钮可在通过/驳回之间切换。

### 后台管理

- 数据看板
- 用户管理
- 照片管理
- 瀑布流排序
- 相册管理
- 标签管理
- 评论管理
- 系统设置

后台设计原则：

- 控件颜色走统一主题变量，不在组件里随意写死颜色。
- 重要状态尽量用按钮直接切换，例如可见性、评论状态、瀑布流置顶。
- 相册头图和相册内照片顺序在相册编辑页处理。
- 首页瀑布流展示顺序在“瀑布流排序”页处理。
- 照片编辑页不再承担瀑布流排序权重配置。

### 主题与视觉

- 支持亮色、暗色、自动跟随系统。
- 支持后台自定义主题。
- 自定义主题支持简单模式和高级模式。
- 主题方案可保存、导入和导出。
- 主题设置带对比度检测和建议色。
- 瀑布流卡片圆角可配置。
- 瀑布流加载动画可配置，包括关闭、模糊显现、自定义 CSS 等。
- 首页主图、照片墙、按钮、标签、地图弹窗、后台表格等都应走主题接口。

## 项目结构

```text
photo-memory/
  backend/
    package.json
    .env.example
    prisma/
      schema.prisma
      seed.js
      migrations/
    uploads/
      originals/
      mediums/
      thumbnails/
    src/
      app.js
      server.js
      config/
      controllers/
      middlewares/
      routes/
      services/
      utils/
  frontend/
    package.json
    index.html
    vite.config.js
    src/
      main.js
      App.vue
      api/
      assets/styles/
        variables.css
        theme-contract.css
        main.css
      components/
      layouts/
      router/
      stores/
      utils/
      views/
  themes/
  Dockerfile
  docker-compose.yml
  docker-compose.ghcr.yml
  docker-compose.aliyun.yml
  docker-entrypoint.sh
  start-dev.bat
  start-dev.ps1
  README.md
```

## 数据库模型

Prisma 模型位于 `backend/prisma/schema.prisma`。

主要模型：

- `User`：用户、角色、状态、资料。
- `Photo`：照片、EXIF、GPS、URL、公开状态、精选、瀑布流展示、排序和统计计数。
- `Album`：相册、头图、公开状态、排序、日期范围。
- `Category`：旧分类兼容模型，前台主要使用标签。
- `Tag`：标签、slug、照片计数。标签颜色统一走主题，不再单独配置标签颜色。
- `PhotoTag`：照片和标签关联。
- `Comment`：登录用户评论和游客评论，包含游客邮箱、IP、设备和审核状态。
- `Favorite`：用户收藏。
- `PhotoView`：浏览记录。
- `SystemSetting`：系统设置、主题、地图、瀑布流配置。
- `UploadLog`：上传日志。
- `LoginGuardBucket`：登录失败次数和锁定状态。

## 环境要求

- Node.js 18+
- npm 9+
- SQLite 无需单独安装
- Windows 本地开发建议使用 PowerShell 运行初始化脚本

## 本地一键启动

项目根目录：

```powershell
.\start-dev.ps1
```

首次拉取项目、依赖缺失、数据库未初始化时：

```powershell
.\start-dev.ps1 -Init
```

可选参数：

- `-Install`：安装前后端依赖。
- `-Migrate`：执行 Prisma migration 并生成 Prisma Client。
- `-Seed`：写入初始化数据。
- `-NoBrowser`：启动后不自动打开浏览器。

如果双击 `start-dev.bat` 一闪而过，请在终端中运行：

```powershell
.\start-dev.ps1 -Init
```

脚本会检查 Node、npm、依赖、`.env`、Prisma Client、SQLite 数据库和端口占用，并给出失败原因。

## 手动启动

后端：

```bash
cd backend
npm install
copy .env.example .env
npx prisma migrate dev
npm run seed
npm run dev
```

默认后端地址：

```text
http://localhost:13033
```

前端：

```bash
cd frontend
npm install
npm run dev
```

默认前端地址：

```text
http://localhost:5173
```

Vite 已代理 `/api` 和 `/uploads` 到后端。

## 初始化账号

管理员：

```text
username: admin
email: admin@example.com
password: admin123456
```

普通用户：

```text
username: demo
email: demo@example.com
password: demo123456
```

首次部署后请尽快修改密码。

## 常用命令

前端构建：

```bash
cd frontend
npm run build
```

后端语法检查示例：

```bash
node --check backend/src/app.js
```

Prisma：

```bash
cd backend
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run seed
```

Git 状态：

```bash
git status
```

## 图片存储规则

本地上传：

- 原图：`backend/uploads/originals`
- 中图：`backend/uploads/mediums`
- 缩略图：`backend/uploads/thumbnails`

Express 通过 `/uploads/...` 暴露静态资源。

删除本地照片时，会删除对应原图、中图和缩略图。外链照片只删除数据库记录，不会操作图床文件。

支持格式：

- jpg
- jpeg
- png
- webp

默认最大上传大小是 15 MB，可在 `.env` 和后台系统设置中调整。`UPLOAD_TRANSPORT_MAX_SIZE_MB` 应大于等于后台允许的最大上传大小。

HEIC 暂未作为稳定上传格式支持，建议先转换为 jpg 或 webp。

## 图床 URL 模式

上传页面可以切换到“图片 URL”模式。

这种模式适合：

- 图片已经上传到图床或 CDN。
- 希望访客直接从图床加载图片。
- 希望节省 NAS 或服务器带宽。

注意：

- URL 必须是 `http://` 或 `https://`。
- 外链图片不自动下载到服务器。
- 外链图片不保证能自动读取 EXIF。
- 图床如果开启防盗链，前台可能无法显示图片。
- 图床失效后，本网站中的外链图片也会失效。

## EXIF 与 GPS

本地上传会尝试读取：

- 拍摄时间
- 相机品牌
- 相机型号
- 镜头型号
- 焦距
- 光圈
- 快门
- ISO
- 曝光补偿
- 白平衡
- 分辨率
- GPS 经纬度

没有 EXIF 的照片不会在详情页显示照片参数面板。

没有 GPS 的照片不会在详情页显示地理位置面板。

作者和管理员可以在编辑页手动补充 EXIF、国家/地区、城市、地点名和经纬度。

## 可见性与相册逻辑

照片可见性：

- `public`：公开。
- `private`：私密，仅作者和管理员可见。

相册可见性：

- 公开相册：游客可见公开照片。
- 私密相册：游客不可见该相册，也不可见相册内照片入口。

首页瀑布流逻辑：

- 首页可展示公开相册卡片。
- 已归档进相册的照片默认不单独展示。
- 相册内照片如果设置为“单独展示”，可作为独立照片卡片出现在首页瀑布流。
- 瀑布流排序页面只管理首页可能出现的公开照片卡片和公开相册卡片。
- 置顶优先级最高，置顶项会排在普通项前面。

照片墙 `/photos` 逻辑：

- 照片墙展示除私密照片以外的照片。
- 照片墙不显示相册卡片。
- 照片墙筛选支持关键词、国家/地区、城市、年份、标签、置顶和精选等。

## 地图配置

后台“系统设置 -> 地图底图”可以选择：

- 百度地图 JSAPI GL
- 高德地图瓦片
- OpenStreetMap
- 自定义 HTTPS 瓦片

百度地图需要：

- Web 端 AK：前端 JSAPI GL 使用，会暴露给浏览器，属于正常现象。
- Server 端 AK：后端地点搜索、地理编码、逆地理编码使用，不会公开。

百度地图生产环境注意：

- Web AK 需要开通 JSAPI GL。
- 如果设置了 Referer 白名单，要包含实际访问域名。
- 如果页面只看到百度 logo 但底图为空，优先检查 CSP、HTTPS、浏览器控制台和 Web AK 服务权限。
- 反向代理不要拦截百度地图脚本、worker、wasm、瓦片资源。

地图页筛选：

- 关键词搜索照片标题。
- 先选国家/地区，再选该国家下的城市。
- 年份选项根据已有照片生成。
- 点击下方照片卡片会让地图跳转到拍摄位置。

## 主题规范

核心文件：

- `frontend/src/assets/styles/variables.css`：亮色/暗色底层色板。
- `frontend/src/assets/styles/theme-contract.css`：统一主题变量接口。
- `frontend/src/assets/styles/main.css`：全局样式和 Element Plus 覆盖。
- `frontend/src/stores/settings.store.js`：读取后台主题设置并写入 CSS 变量。

开发规则：

- 页面、按钮、表格、弹窗、标签、地图、瀑布流、照片卡片都应优先使用 `--theme-*` 变量。
- 不要在组件内随意写死 `#fff`、`#000` 或固定 RGB。
- 控件颜色新增或变更时，先扩展主题接口，再在组件里引用。
- 自定义主题启用后应能覆盖全局主要色彩。

常用接口：

- `--theme-primary-*`
- `--theme-button-*`
- `--theme-input-*`
- `--theme-switch-*`
- `--theme-table-*`
- `--theme-tag-*`
- `--theme-map-*`
- `--theme-image-*`
- `--theme-lightbox-*`
- `--theme-dock-*`
- `--theme-wall-*`
- `--theme-hero-*`

## 安全与限流

已实现：

- bcrypt 密码加密。
- JWT 登录认证。
- 管理员权限中间件。
- 登录失败持久化锁定。
- 登录、注册、上传、评论、地理搜索限流。
- 文件扩展名、MIME 和 sharp 解码校验。
- 超大像素图片防护。
- 上传失败清理落盘文件。
- 基础评论内容过滤。
- Helmet 安全头。
- CSP 已兼容百度地图 JSAPI GL 所需资源。
- 反向代理真实 IP 支持 `TRUST_PROXY_HOPS`。

生产建议：

- 使用强随机 `JWT_SECRET`。
- 后台修改默认账号密码。
- 不要把 Node 服务直接裸露公网。
- 使用 HTTPS。
- Lucky / Nginx 上传体积限制设为至少 100 MB。
- 根据实际代理层数设置 `TRUST_PROXY_HOPS`。

## API 简表

认证：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `PUT /api/auth/password`
- `POST /api/auth/logout`

公开设置：

- `GET /api/settings`

照片：

- `GET /api/photos`
- `GET /api/photos/wall`
- `GET /api/photos/filter-options`
- `GET /api/photos/:id`
- `POST /api/photos/upload`
- `POST /api/photos/batch-upload`
- `POST /api/photos/url`
- `PUT /api/photos/:id`
- `DELETE /api/photos/:id`
- `POST /api/photos/:id/favorite`
- `DELETE /api/photos/:id/favorite`
- `GET /api/photos/:id/comments`
- `POST /api/photos/:id/comments`

相册：

- `GET /api/albums`
- `GET /api/albums/:id`
- `POST /api/albums`
- `PUT /api/albums/:id`
- `DELETE /api/albums/:id`
- `PUT /api/albums/:id/sort-photos`
- `PUT /api/albums/:id/cover`

标签：

- `GET /api/tags`
- `GET /api/tags/:id/photos`

时间轴：

- `GET /api/timeline`
- `GET /api/timeline/years`
- `GET /api/timeline/months`

地图：

- `GET /api/map/photos`
- `GET /api/map/cities`
- `GET /api/map/countries`
- `GET /api/map/years`
- `GET /api/map/places`
- `GET /api/map/geocode`
- `GET /api/map/reverse-geocode`

个人中心：

- `GET /api/my/photos`
- `GET /api/my/albums`
- `GET /api/my/favorites`
- `GET /api/my/comments`
- `GET /api/my/statistics`

管理员：

- `GET /api/admin/statistics`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `PUT /api/admin/users/:id/status`
- `PUT /api/admin/users/:id/role`
- `PUT /api/admin/users/:id/password`
- `GET /api/admin/photos`
- `PUT /api/admin/photos/:id`
- `DELETE /api/admin/photos/:id`
- `PUT /api/admin/photos/:id/feature`
- `PUT /api/admin/photos/:id/visibility`
- `PUT /api/admin/photos/batch`
- `GET /api/admin/albums`
- `POST /api/admin/albums`
- `PUT /api/admin/albums/:id`
- `DELETE /api/admin/albums/:id`
- `GET /api/admin/tags`
- `POST /api/admin/tags`
- `PUT /api/admin/tags/:id`
- `DELETE /api/admin/tags/:id`
- `POST /api/admin/tags/merge`
- `GET /api/admin/comments`
- `PUT /api/admin/comments/:id/status`
- `DELETE /api/admin/comments/:id`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

## Docker 单容器部署

容器内 Express 同时提供：

- 前端静态文件
- 后端 API
- `/uploads` 静态资源
- SQLite 数据访问

本地构建并启动：

```bash
docker compose build
docker compose up -d
```

健康检查：

```bash
curl http://127.0.0.1:8080/api/health
```

默认端口：

```text
8080
```

可通过环境变量修改宿主端口：

```bash
PHOTO_MEMORY_PORT=18080 docker compose up -d
```

容器数据保存在 `/data`：

- `/data/db/photo-memory.db`
- `/data/uploads`

容器启动时会：

1. 创建 `/data/db` 和 `/data/uploads`。
2. 执行 `prisma migrate deploy`。
3. 空库时执行 seed。
4. 启动 Express。

## Docker 环境变量

必填：

```env
JWT_SECRET=replace-with-a-long-random-secret
```

常用：

```env
CLIENT_ORIGIN=https://你的域名
PUBLIC_BASE_URL=https://你的域名
TRUST_PROXY_HOPS=1
PHOTO_MEMORY_PORT=8080
UPLOAD_MAX_SIZE_MB=15
UPLOAD_TRANSPORT_MAX_SIZE_MB=100
```

Docker 内部默认：

```env
NODE_ENV=production
PORT=8080
DATABASE_URL=file:/data/db/photo-memory.db
UPLOAD_ROOT=/data/uploads
FRONTEND_DIST_DIR=/app/frontend/dist
```

## NAS / 预构建镜像部署

GitHub Actions 会构建镜像：

```text
ghcr.io/ruanxue/photo-memory:latest
```

阿里云 ACR 镜像：

```text
crpi-axmbs5adbsdxo86d.cn-shanghai.personal.cr.aliyuncs.com/xzzzz/photo-memory:latest
```

飞牛 NAS 推荐目录：

```text
/vol1/1000/Docker/photo-memory/
  app/    # compose 和 .env
  data/   # SQLite 和上传图片
```

使用阿里云 ACR：

```bash
cd /vol1/1000/Docker/photo-memory/app
docker compose -f docker-compose.aliyun.yml pull
docker compose -f docker-compose.aliyun.yml up -d
docker image prune -f
```

使用 GHCR：

```bash
cd /vol1/1000/Docker/photo-memory/app
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
docker image prune -f
```

升级时：

```bash
cd /vol1/1000/Docker/photo-memory/app
git pull
docker compose -f docker-compose.aliyun.yml pull
docker compose -f docker-compose.aliyun.yml up -d
docker image prune -f
```

## Lucky 反向代理建议

单容器部署时，Lucky 只需要反代一个目标：

```text
http://服务器IP:8080
```

不要拆分 `/api`、`/uploads`，也不要去掉路径前缀。

建议：

- 上传大小限制至少 100 MB。
- 启用 WebSocket 不强制需要，但保留默认也无妨。
- `使用目标地址 Host 请求头` 一般可以开启。
- HTTPS 由 Lucky 负责，容器内部保持 HTTP。
- 如果 Lucky 前面还有 CDN，再按实际层数调整 `TRUST_PROXY_HOPS`。

## Vite 测试环境反代

如果直接把开发环境 `localhost:5173` 反代到公网，Vite 可能提示：

```text
Blocked request. This host is not allowed.
```

需要在 `frontend/vite.config.js` 的 `server.allowedHosts` 中加入测试域名。生产环境建议使用 Docker 构建后的单容器，不建议长期把 Vite dev server 暴露公网。

## 常见问题

### 1. start-dev.bat 一闪而过

在 PowerShell 中运行：

```powershell
.\start-dev.ps1 -Init
```

看脚本自检输出。常见原因是 Node 没装、npm 不在 PATH、依赖缺失、端口被占用或 PowerShell 执行策略限制。

### 2. npm 提示 multer 1.x deprecated

当前项目依赖已升级到 multer 2.x。如果新目录还提示 1.x，通常是旧 `package-lock.json`、旧依赖缓存或没有拉到最新代码。执行：

```powershell
git pull
.\start-dev.ps1 -Install
```

### 3. 百度地图只有 logo，没有底图

检查：

- 是否已填写百度地图 Web 端 AK。
- AK 是否开通 JSAPI GL。
- 域名 Referer 白名单是否包含当前访问域名。
- 浏览器控制台是否有 CSP 报错。
- 是否已经重新构建 Docker 镜像并重启容器。
- 是否被浏览器插件或代理拦截百度资源。

### 4. `/api/settings` 里能看到 Web AK 是否安全

百度 Web 端 AK 本来就会暴露给浏览器，属于前端公开配置。真正敏感的是 Server AK，项目不会通过公开设置接口返回 Server AK。

### 5. 外网上传图片失败

检查：

- Lucky / Nginx 上传体积限制。
- `UPLOAD_TRANSPORT_MAX_SIZE_MB` 是否足够大。
- 后台上传限制是否小于传输限制。
- 反向代理超时时间。
- Docker 数据卷是否可写。

### 6. SQLite 够不够用

个人站点、低并发、几千到数万张照片通常够用。项目已启用 WAL、索引和轻量照片墙接口。明显性能瓶颈通常先出现在图片传输、前端渲染和地图点位，而不是 SQLite 本身。

如果未来需要多人高并发、复杂搜索、几十万级照片或多服务部署，可以迁移到 PostgreSQL。

## 维护约定

- 改 UI 颜色时必须走主题变量接口。
- 不要随意恢复点赞系统。
- 不要重新引入独立分类页面，前台以标签为主。
- 首页瀑布流排序不要绕过后台“瀑布流排序”页面。
- 相册内照片排序和归档/公开状态在相册编辑页处理。
- 地图经纬度数据库统一保存 WGS84。
- Docker 升级不要覆盖 `/data`。
- 用户决定何时提交和推送，不自动推送。
