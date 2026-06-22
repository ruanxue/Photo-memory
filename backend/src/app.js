import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { configureSqlite, prisma } from './config/prisma.js';
import { backendRoot, ensureUploadDirs, uploadRoot } from './utils/file.js';
import { parseTrustProxyValue } from './utils/proxy.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { guardRequestPayload } from './middlewares/security.middleware.js';
import authRoutes from './routes/auth.routes.js';
import photoRoutes from './routes/photo.routes.js';
import albumRoutes from './routes/album.routes.js';
import categoryRoutes from './routes/category.routes.js';
import tagRoutes from './routes/tag.routes.js';
import timelineRoutes from './routes/timeline.routes.js';
import mapRoutes from './routes/map.routes.js';
import searchRoutes from './routes/search.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import settingRoutes from './routes/setting.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await configureSqlite();
await ensureUploadDirs();

const setUploadCacheHeaders = (res, filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/mediums/') || normalized.includes('/thumbnails/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
};

const setFrontendCacheHeaders = (res, filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }
  res.setHeader('Cache-Control', 'no-cache');
};

const renderRateLimitPage = (retryAfter) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>访问太快了 · Photo Memory</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      color: #f3f7f8;
      background:
        radial-gradient(circle at 50% 18%, rgba(210, 238, 244, 0.16), transparent 34%),
        linear-gradient(180deg, #101519, #030405 72%);
      font-family: Inter, "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
    }
    main {
      position: relative;
      width: min(430px, 100%);
      overflow: hidden;
      padding: 30px;
      border: 1px solid rgba(210, 238, 244, 0.22);
      border-radius: 10px;
      background: linear-gradient(145deg, rgba(18, 24, 28, 0.96), rgba(7, 10, 12, 0.96));
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.48);
    }
    .mark {
      position: absolute;
      top: -18px;
      right: 18px;
      color: rgba(255, 255, 255, 0.055);
      font-size: 92px;
      font-weight: 900;
      line-height: 1;
    }
    .kicker {
      margin: 0 0 12px;
      color: #d2eef4;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 30px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: rgba(243, 247, 248, 0.72);
      line-height: 1.8;
    }
    small {
      display: block;
      margin-top: 14px;
      color: rgba(243, 247, 248, 0.56);
    }
    a {
      display: inline-flex;
      margin-top: 24px;
      padding: 10px 16px;
      border: 1px solid rgba(210, 238, 244, 0.36);
      border-radius: 999px;
      color: #071012;
      background: #d2eef4;
      font-weight: 800;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main>
    <span class="mark">429</span>
    <p class="kicker">Photo Memory</p>
    <h1>访问有点太快了</h1>
    <p>为了保护站点，请稍后再继续浏览。</p>
    <small>建议 ${retryAfter} 秒后再试。</small>
    <a href="/">回到首页</a>
  </main>
</body>
</html>`;

const app = express();
app.disable('x-powered-by');

const getInitialTrustProxy = async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'trustProxyHops' } });
    return setting ? parseTrustProxyValue(setting.value) : env.trustProxy;
  } catch {
    return env.trustProxy;
  }
};

const initialTrustProxy = await getInitialTrustProxy();
if (initialTrustProxy) app.set('trust proxy', initialTrustProxy);

const baiduMapCspHosts = [
  'https://api.map.baidu.com',
  'https://*.baidu.com',
  'https://*.bdimg.com',
  'https://*.bcebos.com'
];

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", ...baiduMapCspHosts],
        'script-src-elem': ["'self'", ...baiduMapCspHosts],
        'connect-src': ["'self'", ...baiduMapCspHosts],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'upgrade-insecure-requests': null
      }
    }
  })
);
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(guardRequestPayload);
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Number(req.rateLimit?.resetTime)
        ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
        : 60;
      res.set('Retry-After', String(retryAfter));
      if (!req.path.startsWith('/api') && req.accepts('html')) {
        return res.status(429).type('html').send(renderRateLimitPage(retryAfter));
      }
      res.status(429).json({
        success: false,
        message: '访问太频繁了，请稍后再试',
        details: { retryAfter }
      });
    }
  })
);
app.use('/uploads', express.static(uploadRoot, { setHeaders: setUploadCacheHeaders }));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Photo Memory API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/my', userRoutes);
app.use('/api/admin', adminRoutes);

const frontendDist = process.env.FRONTEND_DIST_DIR || path.resolve(backendRoot, '../frontend/dist');
if (env.nodeEnv === 'production') {
  app.use(express.static(frontendDist, { setHeaders: setFrontendCacheHeaders }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
