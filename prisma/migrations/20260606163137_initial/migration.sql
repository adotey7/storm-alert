-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_logs" (
    "id" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger_reason" TEXT NOT NULL,
    "recipients_count" INTEGER NOT NULL,
    "weather_snapshot" JSONB NOT NULL,

    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_phone_key" ON "subscribers"("phone");

-- CreateIndex
CREATE INDEX "subscribers_region_code_active_idx" ON "subscribers"("region_code", "active");

-- CreateIndex
CREATE INDEX "otp_codes_phone_code_hash_used_idx" ON "otp_codes"("phone", "code_hash", "used");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "alert_logs_region_code_triggered_at_idx" ON "alert_logs"("region_code", "triggered_at");
