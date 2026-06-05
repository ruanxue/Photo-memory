#!/bin/sh
set -eu

if [ -z "${JWT_SECRET:-}" ] || [ "${JWT_SECRET:-}" = "dev-secret-change-me" ]; then
  echo "ERROR: JWT_SECRET must be set to a strong value before starting the container." >&2
  exit 1
fi

UPLOAD_ROOT="${UPLOAD_ROOT:-/data/uploads}"
mkdir -p /data/db \
  "$UPLOAD_ROOT/originals" \
  "$UPLOAD_ROOT/mediums" \
  "$UPLOAD_ROOT/thumbnails"

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding database if empty..."
SEED_ONLY_EMPTY=true node prisma/seed.js

exec "$@"
