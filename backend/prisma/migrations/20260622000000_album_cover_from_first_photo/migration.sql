-- Album cover selection now follows album photo order. The first photo in an
-- album is used as the card cover, so old manually selected cover IDs should no
-- longer override the visible order.
UPDATE "Album"
SET "coverPhotoId" = NULL;
