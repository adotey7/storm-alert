import "server-only";

import { getOptionalEnv } from "@/lib/env";

export function getPublicAppUrl(): string | undefined {
  const appUrl =
    getOptionalEnv("NEXT_PUBLIC_APP_URL") ?? getOptionalEnv("APP_URL");

  return appUrl?.replace(/\/+$/, "");
}

export function getPublicUnsubscribeUrl(): string | undefined {
  const appUrl = getPublicAppUrl();

  return appUrl ? `${appUrl}/unsubscribe` : undefined;
}
