import { handleApiError, jsonError } from "@/lib/api-errors";
import { normalizeGhanaPhone } from "@/lib/phone";
import { getPrisma } from "@/lib/prisma";
import {
  enforceRateLimits,
  getRequestIp,
  RATE_LIMIT_ACTIONS,
} from "@/lib/rate-limit";
import { isRequestAuthorizedBySecret } from "@/lib/shared-secret";

export const runtime = "nodejs";

type WebhookPayload = Record<string, unknown>;
const WEBHOOK_IP_LIMIT = {
  action: RATE_LIMIT_ACTIONS.webhookIp,
  limit: 120,
  windowMs: 60 * 60_000,
  message: "Too many webhook requests. Try again later.",
} as const;

function getString(payload: WebhookPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function extractPhone(payload: WebhookPayload): string {
  const rawPhone = getString(payload, [
    "phone",
    "from",
    "sender",
    "msisdn",
    "recipient",
    "to",
  ]);

  return rawPhone ? normalizeGhanaPhone(rawPhone) : "";
}

function extractMessage(payload: WebhookPayload): string {
  return (
    getString(payload, ["message", "text", "body", "content", "sms"]) ?? ""
  );
}

export async function POST(request: Request) {
  try {
    await enforceRateLimits([
      {
        ...WEBHOOK_IP_LIMIT,
        identifier: getRequestIp(request),
      },
    ]);

    if (!isRequestAuthorizedBySecret(request, "ARKESEL_WEBHOOK_SECRET")) {
      return jsonError("Unauthorized.", 401);
    }

    const payload = (await request.json()) as WebhookPayload;
    const message = extractMessage(payload);
    const phone = extractPhone(payload);

    if (!phone) {
      return jsonError("Webhook payload did not include a phone number.", 400);
    }

    if (!/^stop$/i.test(message.trim())) {
      return Response.json({ message: "Ignored." });
    }

    await getPrisma().subscriber.updateMany({
      where: { phone },
      data: { active: false },
    });

    return Response.json({ message: "Unsubscribed." });
  } catch (error) {
    return handleApiError(error);
  }
}
