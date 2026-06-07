import "server-only";

import { getNumberEnv, getOptionalEnv, requireEnv } from "@/lib/env";

export type ArkeselOtpResult = {
  ussdCode?: string;
  providerResponse?: unknown;
};

export class OtpProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerResponse?: unknown,
  ) {
    super(message);
  }
}

type OtpResponseRecord = {
  code?: unknown;
  message?: unknown;
  ussd_code?: unknown;
};

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toArkeselNumber(phone: string): string {
  return phone.replace(/^\+/, "");
}

function readString(record: OtpResponseRecord, key: keyof OtpResponseRecord) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getOtpExpiryMinutes(): number {
  const configured = getNumberEnv("OTP_EXPIRY_MINUTES", 10);
  return Math.min(Math.max(configured, 1), 10);
}

function getOtpApiKey(): string | undefined {
  const apiKey = getOptionalEnv("ARKESEL_API_KEY");

  if (!apiKey && process.env.NODE_ENV === "production") {
    requireEnv("ARKESEL_API_KEY");
  }

  return apiKey;
}

function getOtpBaseUrl(): string {
  return getOptionalEnv("ARKESEL_API_BASE_URL") ?? "https://sms.arkesel.com";
}

function getSenderId(): string {
  return getOptionalEnv("ARKESEL_SENDER_ID") ?? "StormGH";
}

function createArkeselOtpMessage(): string {
  return "Your StormAlert GH verification code is %otp_code%. It expires in %expiry% minutes.";
}

export function shouldUseArkeselOtp(): boolean {
  return Boolean(getOtpApiKey());
}

export async function generateArkeselOtp(phone: string): Promise<ArkeselOtpResult> {
  const apiKey = requireEnv("ARKESEL_API_KEY");
  const response = await fetch(`${getOtpBaseUrl()}/api/otp/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      expiry: getOtpExpiryMinutes(),
      length: 6,
      medium: "sms",
      message: createArkeselOtpMessage(),
      number: toArkeselNumber(phone),
      sender_id: getSenderId(),
      type: "numeric",
    }),
  });
  const providerResponse = await readJsonSafely(response);
  const record =
    providerResponse && typeof providerResponse === "object"
      ? (providerResponse as OtpResponseRecord)
      : {};
  const providerCode = readString(record, "code");

  if (!response.ok || providerCode !== "1000") {
    throw new OtpProviderError(
      readString(record, "message") ?? "OTP delivery failed.",
      response.status,
      providerResponse,
    );
  }

  return {
    ussdCode: readString(record, "ussd_code"),
    providerResponse,
  };
}

export async function verifyArkeselOtp(
  phone: string,
  code: string,
): Promise<boolean> {
  const apiKey = requireEnv("ARKESEL_API_KEY");
  const response = await fetch(`${getOtpBaseUrl()}/api/otp/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      code,
      number: toArkeselNumber(phone),
    }),
  });
  const providerResponse = await readJsonSafely(response);
  const record =
    providerResponse && typeof providerResponse === "object"
      ? (providerResponse as OtpResponseRecord)
      : {};

  if (response.ok && readString(record, "code") === "1100") {
    return true;
  }

  if (response.status >= 500) {
    throw new OtpProviderError(
      readString(record, "message") ?? "OTP verification failed.",
      response.status,
      providerResponse,
    );
  }

  return false;
}
