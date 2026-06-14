import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, recordRateLimitEvents } = vi.hoisted(() => ({
  prisma: {
    subscriber: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    alertAreaUpdateRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    otpCode: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  recordRateLimitEvents: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => prisma,
}));

vi.mock("@/lib/arkesel-otp", () => ({
  shouldUseArkeselOtp: () => false,
  verifyArkeselOtp: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertWithinRateLimits: vi.fn(),
  clearRateLimitEvents: vi.fn(),
  getRequestIp: () => "203.0.113.1",
  recordRateLimitEvents,
  RATE_LIMIT_ACTIONS: {
    alertAreaUpdateVerifyFailurePhone: "alert_area_update_verify_failure_phone",
    alertAreaUpdateVerifyFailureIp: "alert_area_update_verify_failure_ip",
  },
}));

function verifyRequest(body: unknown) {
  return new Request("https://storm-alert.example/api/update-alert-area/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("update alert area verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.subscriber.findUnique.mockResolvedValue({
      active: true,
      verifiedAt: new Date("2026-06-14T12:00:00.000Z"),
    });
    prisma.alertAreaUpdateRequest.findFirst.mockResolvedValue({
      id: "update_123",
      phone: "+233244123456",
      regionCode: "accra",
      forecastZoneCode: "gh-grid-p5p60-m0p20",
      forecastLat: 5.6,
      forecastLon: -0.2,
      locationAccuracyM: 100,
    });
    prisma.otpCode.findFirst.mockResolvedValue({ id: "otp_123" });
    prisma.otpCode.update.mockReturnValue({ query: "otpCode.update" });
    prisma.alertAreaUpdateRequest.update.mockReturnValue({
      query: "alertAreaUpdateRequest.update",
    });
    prisma.subscriber.update.mockReturnValue({ query: "subscriber.update" });
    prisma.$transaction.mockResolvedValue([]);
  });

  it("applies a verified pending alert-area update to the subscriber", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      verifyRequest({
        phone: "+233244123456",
        code: "123456",
      }),
    );

    expect(response.status).toBe(200);
    expect(prisma.subscriber.update).toHaveBeenCalledWith({
      where: { phone: "+233244123456" },
      data: {
        regionCode: "accra",
        forecastZoneCode: "gh-grid-p5p60-m0p20",
        forecastLat: 5.6,
        forecastLon: -0.2,
        locationAccuracyM: 100,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("records verification failures without applying the update", async () => {
    prisma.otpCode.findFirst.mockResolvedValue(null);

    const { POST } = await import("./route");
    const response = await POST(
      verifyRequest({
        phone: "+233244123456",
        code: "123456",
      }),
    );

    expect(response.status).toBe(400);
    expect(recordRateLimitEvents).toHaveBeenCalled();
    expect(prisma.subscriber.update).not.toHaveBeenCalled();
  });

  it("requires a pending update request before accepting a code", async () => {
    prisma.alertAreaUpdateRequest.findFirst.mockResolvedValue(null);

    const { POST } = await import("./route");
    const response = await POST(
      verifyRequest({
        phone: "+233244123456",
        code: "123456",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Request a new update code first.");
    expect(prisma.subscriber.update).not.toHaveBeenCalled();
  });
});
