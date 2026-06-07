import { describe, expect, it, vi } from "vitest";
import {
  getOtpCodeValidationError,
  sanitizeOtpInput,
  OTP_CODE_PATTERN,
} from "./otp-code";
import { createOtpCode, getOtpExpiryDate, hashOtpCode } from "./otp";

describe("OTP utilities", () => {
  it("creates a six-digit numeric code", () => {
    expect(createOtpCode()).toMatch(OTP_CODE_PATTERN);
  });

  it("calculates expiry from the configured minute window", () => {
    vi.stubEnv("OTP_EXPIRY_MINUTES", "15");

    expect(getOtpExpiryDate(new Date("2026-06-06T12:00:00.000Z"))).toEqual(
      new Date("2026-06-06T12:15:00.000Z"),
    );

    vi.unstubAllEnvs();
  });

  it("hashes codes deterministically and includes the pepper", () => {
    vi.stubEnv("OTP_PEPPER", "pepper-one");
    const firstHash = hashOtpCode("+233244123456", "123456");

    vi.stubEnv("OTP_PEPPER", "pepper-two");
    const secondHash = hashOtpCode("+233244123456", "123456");

    expect(firstHash).toHaveLength(64);
    expect(firstHash).not.toBe(secondHash);

    vi.unstubAllEnvs();
  });

  it("sanitizes and validates user-entered codes", () => {
    expect(sanitizeOtpInput("12 a34-567")).toBe("123456");
    expect(getOtpCodeValidationError("")).toBe("Enter the verification code");
    expect(getOtpCodeValidationError("123")).toBe("Enter the 6-digit code");
    expect(getOtpCodeValidationError("123456")).toBeUndefined();
  });
});
