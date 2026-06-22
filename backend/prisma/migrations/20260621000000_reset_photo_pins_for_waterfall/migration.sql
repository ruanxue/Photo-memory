-- Photo pinning has moved to the waterfall ordering page. Existing photo
-- pin states came from the old photo-management flow and should no longer
-- affect public ordering or card markers.
UPDATE "Photo"
SET "isPinned" = false,
    "pinnedAt" = NULL;
