import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateArkeselOtp,
  OtpProviderError,
  verifyArkeselOtp,
} from "./arkesel-otp";

describe("Arkesel OTP client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("wraps generate network failures as provider errors", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "test-api-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(generateArkeselOtp("+233244123456")).rejects.toMatchObject({
      message: "OTP service is temporarily unavailable.",
      status: 503,
    });
    await expect(generateArkeselOtp("+233244123456")).rejects.toBeInstanceOf(
      OtpProviderError,
    );
  });

  it("wraps verify network failures as provider errors", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "test-api-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(verifyArkeselOtp("+233244123456", "123456")).rejects.toMatchObject({
      message: "OTP service is temporarily unavailable.",
      status: 503,
    });
  });
});
