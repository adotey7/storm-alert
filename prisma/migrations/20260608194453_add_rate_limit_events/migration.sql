-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_events_action_identifier_created_at_idx" ON "rate_limit_events"("action", "identifier", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_events_created_at_idx" ON "rate_limit_events"("created_at");
