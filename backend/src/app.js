import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { backendRoot, ensureUploadDirs, uploadRoot } from './utils/file.js';
import { parseTrustProxyValue } from './utils/proxy.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
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
await ensureUploadDirs();

const app = express();

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
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use('/uploads', express.static(uploadRoot));

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
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
