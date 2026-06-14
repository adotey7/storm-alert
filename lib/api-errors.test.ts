import { describe, expect, it } from "vitest";
import { handleApiError } from "./api-errors";
import { OtpProviderError } from "./arkesel-otp";

describe("handleApiError", () => {
  it("preserves OTP provider unavailable responses", async () => {
    const response = handleApiError(
      new OtpProviderError("OTP service is temporarily unavailable.", 503),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("OTP service is temporarily unavailable.");
  });

  it("maps non-server OTP provider failures to a gateway error", async () => {
    const response = handleApiError(
      new OtpProviderError("OTP delivery failed.", 400),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("OTP delivery failed.");
  });
});
