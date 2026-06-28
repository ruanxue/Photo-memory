ALTER TABLE "Photo" ADD COLUMN "externalStatus" TEXT;
ALTER TABLE "Photo" ADD COLUMN "externalCheckedAt" DATETIME;
ALTER TABLE "Photo" ADD COLUMN "externalError" TEXT;
ALTER TABLE "Photo" ADD COLUMN "externalSourceUrl" TEXT;
ALTER TABLE "Photo" ADD COLUMN "externalCachedAt" DATETIME;

CREATE INDEX "Photo_externalStatus_idx" ON "Photo"("externalStatus");
