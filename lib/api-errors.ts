import { ZodError } from "zod";
import { OtpProviderError } from "@/lib/arkesel-otp";
import { MissingEnvError } from "@/lib/env";
import { RateLimitExceededError } from "@/lib/rate-limit";
import { SmsDeliveryError } from "@/lib/sms-dispatcher";

export function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  return Response.json({ error: message }, { status, headers });
}

/**
 * Builds the response for an unexpected error and, crucially, records the real
 * cause to the server log. The previous implementation swallowed the error and
 * returned a generic 500 with no logging, which made production failures (e.g.
 * a transient upstream forecast fetch, a Prisma write error, an SMS provider
 * network fault) invisible in observability tooling. Keep this logging.
 */
function handleUnexpectedError(error: unknown): Response {
  console.error("[api] unexpected error:", error);
  const errorName =
    error instanceof Error && error.name ? error.name : "UnknownError";

  return Response.json(
    { error: "Unexpected server error.", errorName },
    { status: 500 },
  );
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return jsonError("Invalid request payload.", 400);
  }

  if (error instanceof MissingEnvError) {
    return jsonError(`${error.name} is not configured.`, 503);
  }

  if (error instanceof SmsDeliveryError) {
    return jsonError(error.message, 502);
  }

  if (error instanceof OtpProviderError) {
    return jsonError(error.message, error.status >= 500 ? error.status : 502);
  }

  if (error instanceof RateLimitExceededError) {
    return jsonError(error.message, 429, {
      "Retry-After": String(error.retryAfterSeconds),
    });
  }

  return handleUnexpectedError(error);
}
