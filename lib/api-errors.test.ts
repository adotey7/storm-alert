import { describe, expect, it, vi } from "vitest";
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

  it("logs and surfaces the error name for unexpected errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = handleApiError(
      new TypeError("fetch failed: ECONNRESET to upstream forecast"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unexpected server error.");
    expect(body.errorName).toBe("TypeError");
    expect(consoleError).toHaveBeenCalledWith(
      "[api] unexpected error:",
      expect.any(TypeError),
    );

    consoleError.mockRestore();
  });
});
