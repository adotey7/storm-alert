-- CreateTable
CREATE TABLE "alert_area_update_requests" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "forecast_zone_code" TEXT,
    "forecast_lat" DOUBLE PRECISION,
    "forecast_lon" DOUBLE PRECISION,
    "location_accuracy_m" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_area_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_area_update_requests_phone_consumed_at_expires_at_created_at_idx" ON "alert_area_update_requests"("phone", "consumed_at", "expires_at", "created_at");

-- CreateIndex
CREATE INDEX "alert_area_update_requests_expires_at_idx" ON "alert_area_update_requests"("expires_at");
