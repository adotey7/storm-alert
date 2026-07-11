import "server-only";

import { getOptionalEnv, requireEnv } from "@/lib/env";

export type SmsDeliveryResult = {
  sent: boolean;
  skipped: boolean;
  providerResponse?: unknown;
};

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerResponse?: unknown,
  ) {
    super(message);
  }
}

type SendSmsInput = {
  recipients: string[];
  message: string;
};

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toArkeselRecipient(phone: string): string {
  return phone.replace(/^\+/, "");
}

export async function sendSms({
  recipients,
  message,
}: SendSmsInput): Promise<SmsDeliveryResult> {
  const apiKey = getOptionalEnv("ARKESEL_API_KEY");

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      requireEnv("ARKESEL_API_KEY");
    }

    return { sent: false, skipped: true };
  }

  const baseUrl =
    getOptionalEnv("ARKESEL_API_BASE_URL") ?? "https://sms.arkesel.com";
  const response = await fetch(`${baseUrl}/api/v2/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: getOptionalEnv("ARKESEL_SENDER_ID") ?? "StormGH",
      message,
      recipients: recipients.map(toArkeselRecipient),
    }),
  });
  const providerResponse = await readJsonSafely(response);

  if (!response.ok) {
    throw new SmsDeliveryError(
      "SMS delivery failed.",
      response.status,
      providerResponse,
    );
  }

  return {
    sent: true,
    skipped: false,
    providerResponse,
  };
}

export function createOtpMessage(code: string): string {
  return `StormAlert GH: Your verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`;
}

export function createAlertAreaUpdateMessage(code: string): string {
  return `StormAlert GH: Use code ${code} to update your flood alert location. This code expires in 10 minutes. If you did not request this, ignore this message.`;
}
