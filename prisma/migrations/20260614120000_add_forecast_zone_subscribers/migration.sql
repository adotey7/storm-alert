-- AlterTable
ALTER TABLE "subscribers"
ADD COLUMN "forecast_zone_code" TEXT,
ADD COLUMN "forecast_lat" DOUBLE PRECISION,
ADD COLUMN "forecast_lon" DOUBLE PRECISION,
ADD COLUMN "location_accuracy_m" INTEGER;

-- CreateIndex
CREATE INDEX "subscribers_forecast_zone_code_active_idx" ON "subscribers"("forecast_zone_code", "active");
