import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';

const publicApiCacheStore = new LRUCache({
  max: 300,
  ttl: 60 * 1000
});

const PUBLIC_CACHE_RULES = [
  { prefix: '/api/settings', ttl: 30 * 1000 },
  { prefix: '/api/photos/wall', ttl: 30 * 1000 },
  { prefix: '/api/albums', ttl: 60 * 1000 },
  { prefix: '/api/tags', ttl: 60 * 1000 },
  { prefix: '/api/timeline', ttl: 60 * 1000 },
  { prefix: '/api/map/photos', ttl: 30 * 1000 },
  { prefix: '/api/map/cities', ttl: 60 * 1000 },
  { prefix: '/api/map/countries', ttl: 60 * 1000 }
];

const MUTATION_PREFIXES = [
  '/api/admin',
  '/api/photos',
  '/api/albums',
  '/api/tags',
  '/api/settings',
  '/api/my'
];

const ttlForPath = (requestPath) => {
  const rule = PUBLIC_CACHE_RULES.find((item) => requestPath === item.prefix || requestPath.startsWith(`${item.prefix}/`));
  return rule?.ttl || 0;
};

const makeCacheKey = (req) => `${req.method}:${req.originalUrl}`;

const makeEtag = (body) => {
  const hash = createHash('sha1').update(Buffer.isBuffer(body) ? body : String(body)).digest('base64url');
  return `W/"pm-${hash}"`;
};

const isNoCacheRequest = (req) => {
  const cacheControl = String(req.headers['cache-control'] || '');
  return cacheControl.includes('no-cache') || cacheControl.includes('no-store');
};

const shouldCacheRequest = (req) => {
  if (req.method !== 'GET') return false;
  if (req.headers.authorization) return false;
  if (isNoCacheRequest(req)) return false;
  return ttlForPath(req.path) > 0;
};

const serializeBody = (body) => {
  if (Buffer.isBuffer(body) || typeof body === 'string') return body;
  if (body === undefined || body === null) return '';
  return JSON.stringify(body);
};

const seconds = (ms) => Math.max(1, Math.floor(ms / 1000));

export const clearPublicApiCache = () => {
  publicApiCacheStore.clear();
};

export const publicApiCache = (req, res, next) => {
  if (!shouldCacheRequest(req)) return next();

  const ttl = ttlForPath(req.path);
  const key = makeCacheKey(req);
  const cached = publicApiCacheStore.get(key);

  if (cached) {
    res.setHeader('X-Photo-Memory-Cache', 'HIT');
    res.setHeader('Cache-Control', `public, max-age=${seconds(ttl)}, stale-while-revalidate=${seconds(ttl)}`);
    res.setHeader('ETag', cached.etag);
    if (cached.contentType) res.setHeader('Content-Type', cached.contentType);

    if (req.headers['if-none-match'] === cached.etag) {
      return res.status(304).end();
    }

    return res.status(cached.statusCode).send(cached.body);
  }

  const originalSend = res.send.bind(res);
  res.setHeader('X-Photo-Memory-Cache', 'MISS');

  res.send = (body) => {
    const serializedBody = serializeBody(body);

    if (res.statusCode === 200) {
      const etag = makeEtag(serializedBody);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', `public, max-age=${seconds(ttl)}, stale-while-revalidate=${seconds(ttl)}`);

      publicApiCacheStore.set(
        key,
        {
          body: serializedBody,
          contentType: res.getHeader('Content-Type'),
          etag,
          statusCode: res.statusCode
        },
        { ttl }
      );
    }

    return originalSend(body);
  };

  return next();
};

export const invalidatePublicApiCacheOnMutation = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const shouldInvalidate = MUTATION_PREFIXES.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
  );

  if (shouldInvalidate) {
    res.on('finish', () => {
      if (res.statusCode < 400) clearPublicApiCache();
    });
  }

  return next();
};
