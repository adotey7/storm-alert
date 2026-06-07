import { ZodError } from "zod";
import { OtpProviderError } from "@/lib/arkesel-otp";
import { MissingEnvError } from "@/lib/env";
import { SmsDeliveryError } from "@/lib/sms-dispatcher";

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
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
    return jsonError(error.message, 502);
  }

  return jsonError("Unexpected server error.", 500);
}
