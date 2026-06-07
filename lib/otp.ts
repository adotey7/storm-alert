import "server-only";

import { createHash, randomInt } from "node:crypto";
import { getNumberEnv, getOptionalEnv } from "@/lib/env";
import { OTP_CODE_LENGTH } from "@/lib/otp-code";

export function createOtpCode(): string {
  return randomInt(0, 10 ** OTP_CODE_LENGTH)
    .toString()
    .padStart(OTP_CODE_LENGTH, "0");
}

export function getOtpExpiryDate(now = new Date()): Date {
  const expiryMinutes = getNumberEnv("OTP_EXPIRY_MINUTES", 10);
  return new Date(now.getTime() + expiryMinutes * 60_000);
}

export function hashOtpCode(phone: string, code: string): string {
  const pepper = getOptionalEnv("OTP_PEPPER") ?? "";

  return createHash("sha256")
    .update(`${pepper}:${phone}:${code}`)
    .digest("hex");
}
