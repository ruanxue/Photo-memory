FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci

COPY backend ./
RUN npx prisma generate

COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /data/db /data/uploads/originals /data/uploads/mediums /data/uploads/thumbnails

ENV NODE_ENV=production \
  PORT=8080 \
  DATABASE_URL=file:/data/db/photo-memory.db \
  UPLOAD_ROOT=/data/uploads \
  FRONTEND_DIST_DIR=/app/frontend/dist \
  UPLOAD_MAX_SIZE_MB=15 \
  UPLOAD_TRANSPORT_MAX_SIZE_MB=100 \
  TRUST_PROXY_HOPS=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
