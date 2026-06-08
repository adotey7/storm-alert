import "server-only";

import { timingSafeEqual } from "node:crypto";
import { getOptionalEnv, requireEnv } from "@/lib/env";

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isRequestAuthorizedBySecret(
  request: Request,
  envName: string,
): boolean {
  const configuredSecret = getOptionalEnv(envName);

  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      requireEnv(envName);
    }

    return true;
  }

  const url = new URL(request.url);
  const providedSecret =
    request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");

  return providedSecret ? safeEquals(providedSecret, configuredSecret) : false;
}
