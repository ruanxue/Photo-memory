-- Add persistent login guard buckets for brute-force protection.
CREATE TABLE IF NOT EXISTS "LoginGuardBucket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoginGuardBucket_key_key" ON "LoginGuardBucket"("key");
CREATE INDEX IF NOT EXISTS "LoginGuardBucket_lockedUntil_idx" ON "LoginGuardBucket"("lockedUntil");
CREATE INDEX IF NOT EXISTS "LoginGuardBucket_updatedAt_idx" ON "LoginGuardBucket"("updatedAt");

-- Composite indexes for public wall, album, city and map queries.
CREATE INDEX IF NOT EXISTS "Photo_status_visibility_uploadedAt_idx" ON "Photo"("status", "visibility", "uploadedAt");
CREATE INDEX IF NOT EXISTS "Photo_status_visibility_takenAt_idx" ON "Photo"("status", "visibility", "takenAt");
CREATE INDEX IF NOT EXISTS "Photo_status_visibility_isPinned_sortOrder_idx" ON "Photo"("status", "visibility", "isPinned", "sortOrder");
CREATE INDEX IF NOT EXISTS "Photo_status_visibility_isFeatured_uploadedAt_idx" ON "Photo"("status", "visibility", "isFeatured", "uploadedAt");
CREATE INDEX IF NOT EXISTS "Photo_albumId_status_idx" ON "Photo"("albumId", "status");
CREATE INDEX IF NOT EXISTS "Photo_city_status_idx" ON "Photo"("city", "status");
CREATE INDEX IF NOT EXISTS "Photo_country_status_idx" ON "Photo"("country", "status");
CREATE INDEX IF NOT EXISTS "Photo_latitude_longitude_status_idx" ON "Photo"("latitude", "longitude", "status");
