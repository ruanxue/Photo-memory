-- Add an explicit opt-in for album photos that should also appear as standalone waterfall cards.
ALTER TABLE "Photo" ADD COLUMN "showInWaterfall" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Photo_albumId_showInWaterfall_status_idx"
ON "Photo"("albumId", "showInWaterfall", "status");
