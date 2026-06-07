import { handleApiError, jsonError } from "@/lib/api-errors";
import { normalizeGhanaPhone } from "@/lib/phone";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

type WebhookPayload = Record<string, unknown>;

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
