# Photo Memory / 照片映像

Photo Memory 是一个前后端分离的个人照片展示网站，用于记录旅游、生活、日常和摄影作品。项目参考瀑布流图片展示、相册浏览、时间轴、旅行行程、分类标签、照片详情、大图灯箱和地图浏览等体验，使用 Vue 3 + Node.js + SQLite 实现完整闭环。

## 技术栈

- 前端：Vue 3、Vite、Vue Router、Pinia、Axios、Element Plus、Leaflet、CSS Columns 瀑布流
- 后端：Node.js、Express、Prisma ORM、SQLite、JWT、bcryptjs、multer、sharp、exifr
- 数据库：SQLite，由 Prisma 管理模型和迁移
- 图片处理：原图保留，sharp 生成 1600px 中图和 480px 缩略图

## 功能列表

- 登录注册、JWT 鉴权、路由守卫、管理员权限控制
- 单张和批量照片上传、拖拽选择、上传进度、格式与大小校验
- 自动读取 EXIF、GPS、尺寸、设备参数，支持手动编辑
- 首页 Hero 可由后台从公开照片中选择候选图，并支持随机或固定主图
- 照片瀑布流、分页筛选、灯箱预览、懒加载
- 照片详情页：大图、参数、作者、相册、分类、标签、地图、评论、收藏、上一张/下一张
- 相册、分类、标签、时间轴、地图、搜索页面
- 普通用户中心：资料、密码、上传、我的照片、我的相册、收藏、评论、统计
- 管理后台：数据看板、用户、照片、相册、分类、标签、评论、系统设置
- 公开/私密照片控制，游客只能看公开照片
- 置顶、精选、排序权重、批量删除、批量可见性、批量打标签
- 暗色模式、首页主图、访客评论开关与审核、上传开关、注册开关、水印开关配置
- 访客无需登录即可评论；评论邮箱仅后台可见

## 项目结构

```text
photo-memory/
  backend/
    package.json
    .env.example
    prisma/
      schema.prisma
      seed.js
    uploads/
      originals/
      mediums/
      thumbnails/
    src/
      app.js
      server.js
      config/
      routes/
      controllers/
      services/
      middlewares/
      utils/
  frontend/
    package.json
    index.html
    vite.config.js
    src/
      main.js
      App.vue
      router/
      stores/
      api/
      layouts/
      views/
      components/
      utils/
      assets/styles/
  README.md
```

## 数据库模型

Prisma 模型位于 `backend/prisma/schema.prisma`，包含：

- `User`：用户、角色、状态、资料
- `Photo`：照片、EXIF、GPS、公开状态、置顶精选、统计计数
- `Album`：相册、封面、公开状态、排序、日期范围
- `Category`：分类、slug、封面、照片计数
- `Tag`：标签、颜色、照片计数
- `PhotoTag`：照片标签关联
- `Comment`：评论和审核状态
- `Favorite`：收藏唯一记录
- `PhotoView`：浏览记录
- `SystemSetting`：系统配置
- `UploadLog`：上传日志

## 环境要求

- Node.js 18+
- npm 9+
- SQLite 无需单独安装

## 一键启动脚本

Windows 下可在项目根目录运行：

```powershell
.\start-dev.ps1
```

也可以双击或在 CMD 中运行：

```bat
start-dev.bat
```

首次运行或需要重新安装依赖、迁移数据库、写入初始化数据时：

```powershell
.\start-dev.ps1 -Init
```

常用参数：
- `-Install`：重新安装前后端依赖
- `-Migrate`：执行 Prisma migration 并生成 Prisma Client
- `-Seed`：写入初始化数据
- `-NoBrowser`：启动后不自动打开浏览器

## 后端启动

```bash
cd backend
npm install
copy .env.example .env
npx prisma migrate dev
npm run seed
npm run dev
```

后端默认运行在 `http://localhost:13033`。

## 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`，Vite 已代理 `/api` 和 `/uploads` 到后端。

## 初始化账号

- 管理员：
  - 用户名：`admin`
  - 密码：`admin123`
- 普通用户：
  - 用户名：`user`
  - 密码：`user123`

建议首次登录后立即修改密码。

## 图片存储

- 原图：`backend/uploads/originals`
- 中图：`backend/uploads/mediums`
- 缩略图：`backend/uploads/thumbnails`

Express 通过 `/uploads/...` 暴露静态资源。删除照片时，若图片是本地上传文件，会同时删除原图、中图和缩略图。

## 图片上传限制

- 支持：jpg、jpeg、png、webp
- 默认最大：15 MB，可在 `.env` 和系统设置中调整
- HEIC 暂未直接解析，建议先转换为 jpg/webp 后上传
- 上传目录只保存图片文件，不执行脚本

## EXIF 和 GPS

后端使用 `exifr` 读取拍摄时间、相机、镜头、焦距、光圈、快门、ISO、曝光补偿、白平衡、GPS。若照片没有 EXIF 或 GPS，作者和管理员可在此前端编辑页手动补充。

## API 简要说明

认证：
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `PUT /api/auth/password`
- `POST /api/auth/logout`

照片：
- `GET /api/photos`
- `GET /api/photos/:id`
- `POST /api/photos/upload`
- `POST /api/photos/batch-upload`
- `PUT /api/photos/:id`
- `DELETE /api/photos/:id`
- `POST /api/photos/:id/favorite`
- `DELETE /api/photos/:id/favorite`
- `GET /api/photos/:id/comments`
- `POST /api/photos/:id/comments`

访客评论需提交 `guestName` 和 `guestEmail`，邮箱不会出现在公开评论响应中。

相册、分类、标签、时间轴、地图、搜索：
- `GET /api/albums`
- `GET /api/albums/:id`
- `POST /api/albums`
- `PUT /api/albums/:id`
- `DELETE /api/albums/:id`
- `PUT /api/albums/:id/sort-photos`
- `PUT /api/albums/:id/cover`
- `GET /api/categories`
- `GET /api/categories/:id/photos`
- `GET /api/tags`
- `GET /api/tags/:id/photos`
- `GET /api/timeline`
- `GET /api/timeline/years`
- `GET /api/timeline/months`
- `GET /api/map/photos`
- `GET /api/map/cities`
- `GET /api/map/countries`
- `GET /api/search`

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
- `GET /api/admin/photos`
- `PUT /api/admin/photos/:id`
- `DELETE /api/admin/photos/:id`
- `PUT /api/admin/photos/:id/pin`
- `PUT /api/admin/photos/:id/feature`
- `PUT /api/admin/photos/:id/visibility`
- `PUT /api/admin/photos/batch`
- `GET /api/admin/albums`
- `POST /api/admin/albums`
- `PUT /api/admin/albums/:id`
- `DELETE /api/admin/albums/:id`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
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

## 常见问题

1. 前端请求失败：确认后端在 `13033` 端口运行，前端在 `5173` 端口运行。
2. Prisma 找不到数据库：确认已复制 `.env.example` 为 `.env` 并执行 `npx prisma migrate dev`。
3. 图片上传失败：检查文件类型和大小，默认仅允许 jpg、jpeg、png、webp。
4. 地图不显示：Leaflet 使用 OpenStreetMap 瓦片，需要浏览器能访问 OSM。
5. 示例图加载慢：示例照片使用外部 URL，生产环境建议替换为本地上传图片。

## 部署说明

生产部署时建议：
- 后端设置强随机 `JWT_SECRET`
- 修改 `CLIENT_ORIGIN` 为前端域名
- 使用 Nginx 反向代理 `/api` 和 `/uploads`
- 反向代理只有一层时设置 `TRUST_PROXY_HOPS=1`，以便评论审计记录真实访客 IP；也可在后台“系统设置 -> 部署与代理”中调整 `TRUST_PROXY_HOPS`
- 将 `backend/uploads` 挂载到持久化磁盘
- 使用 `npm run build` 构建前端，再用 Nginx 或静态托管服务发布
- SQLite 适合个人站点；若并发提高，可迁移 Prisma datasource 到 PostgreSQL/MySQL

## Docker 单容器部署

项目已支持单容器部署：容器内由 Express 同时提供前端页面、后端 API、`/uploads` 静态资源和 SQLite。Lucky 只需要反代一个端口。

1. 准备环境变量：

```bash
export JWT_SECRET="replace-with-a-long-random-secret"
export CLIENT_ORIGIN="https://你的域名"
export PUBLIC_BASE_URL="https://你的域名"
export TRUST_PROXY_HOPS=1
```

2. 构建并启动：

```bash
docker compose build
docker compose up -d
```

3. 访问和检查：

```bash
curl http://127.0.0.1:8080/api/health
```

默认端口是 `8080`，可通过 `PHOTO_MEMORY_PORT=18080 docker compose up -d` 改宿主机端口。SQLite 数据库和上传文件都保存在 Docker 卷 `photo_memory_data` 的 `/data` 目录中，升级镜像不会丢失。

容器启动时会执行：
- `prisma migrate deploy`
- 当数据库没有任何用户时执行初始化 seed
- 启动 `npm run start`

Lucky 反代时只配置一个目标：

```text
http://服务器IP:8080
```

不要去掉 `/api` 或 `/uploads` 前缀。Lucky 中请求体/上传大小限制建议设置为至少 `100MB`。

## GHCR 镜像部署与 NAS 升级

仓库已提供 GitHub Actions 工作流：每次推送 `main` 分支后，会自动构建并推送镜像：

```text
ghcr.io/ruanxue/photo-memory:latest
```

同时支持推送到阿里云 ACR。需要先在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中新增：

```text
ALIYUN_USERNAME
ALIYUN_PASSWORD
```

配置完成后，每次推送 `main` 还会生成：

```text
crpi-axmbs5adbsdxo86d.cn-shanghai.personal.cr.aliyuncs.com/xzzzz/photo-memory:latest
```

飞牛 NAS 推荐使用预构建镜像运行，不在 NAS 上本地编译。目录建议：

```text
/vol1/1000/Docker/photo-memory/
  app/   # 只放 compose 和 .env
  data/  # SQLite 数据库和上传图片
```

NAS 上直接使用 `docker-compose.ghcr.yml`，不要覆盖仓库自带的 `docker-compose.yml`，这样后续 `git pull` 不会产生本地冲突。

如果使用阿里云 ACR 镜像，则使用 `docker-compose.aliyun.yml`，国内下载速度通常更快。

创建 `.env`：

```env
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGIN=http://192.168.100.186:8080
PUBLIC_BASE_URL=http://192.168.100.186:8080
TRUST_PROXY_HOPS=1
PHOTO_MEMORY_PORT=8080
UPLOAD_MAX_SIZE_MB=15
UPLOAD_TRANSPORT_MAX_SIZE_MB=100
```

启动：

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

阿里云 ACR 版本：

```bash
docker compose -f docker-compose.aliyun.yml pull
docker compose -f docker-compose.aliyun.yml up -d
```

后续升级只需要等待 GitHub Actions 构建完成，然后在 NAS 上执行：

```bash
cd /vol1/1000/Docker/photo-memory/app
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
docker image prune -f
```

使用阿里云 ACR 时：

```bash
cd /vol1/1000/Docker/photo-memory/app
git pull
docker compose -f docker-compose.aliyun.yml pull
docker compose -f docker-compose.aliyun.yml up -d
docker image prune -f
```

如果 GHCR 镜像是私有状态，需要先在 GitHub 创建带 `read:packages` 权限的 token，并在 NAS 上登录：

```bash
echo "你的 GitHub Token" | docker login ghcr.io -u ruanxue --password-stdin
```

如果希望免登录拉取镜像，请在 GitHub 的 Packages 页面把 `photo-memory` 容器包可见性改为 Public。

反向代理示例：

```nginx
client_max_body_size 100m;

location /api/ {
  proxy_pass http://127.0.0.1:13033/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_connect_timeout 60s;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  proxy_request_buffering off;
}

location /uploads/ {
  proxy_pass http://127.0.0.1:13033/uploads/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

外网上传失败时优先检查 `client_max_body_size`，Nginx 默认通常只有 1MB；如果上传大图或批量上传，还需要较长的 `proxy_read_timeout` / `proxy_send_timeout`。后端 `.env` 中 `UPLOAD_TRANSPORT_MAX_SIZE_MB` 应大于或等于后台“上传文件大小限制”，否则请求会先被 multer 拦截。

如果前面还有 CDN 或多层代理，`TRUST_PROXY_HOPS` 要改成实际代理层数。后台保存后会影响新的请求，并会保存到数据库；后端重启时会优先读取数据库中的 `trustProxyHops`，`.env` 作为首次部署或数据库不可用时的兜底。不要把 Node 服务直接暴露到公网后再信任任意 `X-Forwarded-For`。

## 注意事项

- 当前项目实现了基础内容过滤和权限控制，但生产环境仍建议增加验证码、邮箱验证、审计日志和更严格的速率限制。
- 水印开关作为系统配置项已提供，实际水印叠加可在 `backend/src/services/image.service.js` 中继续扩展 sharp pipeline。
- 评论审核由系统设置 `commentReview` 控制，开启后新评论进入 `pending`。
