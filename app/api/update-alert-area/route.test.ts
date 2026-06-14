import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, sendSms } = vi.hoisted(() => ({
  prisma: {
    subscriber: {
      findUnique: vi.fn(),
    },
    alertAreaUpdateRequest: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    otpCode: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  sendSms: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => prisma,
}));

vi.mock("@/lib/sms-dispatcher", () => ({
  createAlertAreaUpdateMessage: (code: string) =>
    `StormAlert GH: Your alert area update code is ${code}. It expires soon.`,
  sendSms,
}));

vi.mock("@/lib/arkesel-otp", () => ({
  generateArkeselOtp: vi.fn(),
  shouldUseArkeselOtp: () => false,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimits: vi.fn(),
  getRequestIp: () => "203.0.113.1",
  RATE_LIMIT_ACTIONS: {
    alertAreaUpdateAttemptPhone: "alert_area_update_attempt_phone",
    alertAreaUpdateAttemptIp: "alert_area_update_attempt_ip",
    alertAreaUpdateOtpSendPhoneCooldown:
      "alert_area_update_otp_send_phone_cooldown",
    alertAreaUpdateOtpSendPhone: "alert_area_update_otp_send_phone",
    alertAreaUpdateOtpSendIp: "alert_area_update_otp_send_ip",
  },
}));

function updateRequest(body: unknown) {
  return new Request("https://storm-alert.example/api/update-alert-area", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("update alert area route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.subscriber.findUnique.mockResolvedValue({
      active: true,
      verifiedAt: new Date("2026-06-14T12:00:00.000Z"),
    });
    prisma.alertAreaUpdateRequest.updateMany.mockReturnValue({
      query: "alertAreaUpdateRequest.updateMany",
    });
    prisma.alertAreaUpdateRequest.create.mockReturnValue({
      query: "alertAreaUpdateRequest.create",
    });
    prisma.otpCode.updateMany.mockReturnValue({ query: "otpCode.updateMany" });
    prisma.otpCode.create.mockReturnValue({ query: "otpCode.create" });
    prisma.$transaction.mockResolvedValue([]);
    sendSms.mockResolvedValue({ sent: false, skipped: true });
  });

  it("creates a pending rounded local-area update for an active subscriber", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      updateRequest({
        phone: "+233244123456",
        region_code: "accra",
        location: {
          latitude: 5.6037,
          longitude: -0.187,
          accuracy_m: 99.7,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(prisma.alertAreaUpdateRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: "+233244123456",
        regionCode: "accra",
        forecastZoneCode: "gh-grid-p5p60-m0p20",
        forecastLat: 5.6,
        forecastLon: -0.2,
        locationAccuracyM: 100,
      }),
    });
    expect(prisma.otpCode.create).toHaveBeenCalled();
  });

  it("rejects updates for numbers without an active verified subscription", async () => {
    prisma.subscriber.findUnique.mockResolvedValue({
      active: false,
      verifiedAt: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      updateRequest({
        phone: "+233244123456",
        region_code: "accra",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Subscribe and verify");
    expect(prisma.alertAreaUpdateRequest.create).not.toHaveBeenCalled();
  });

  it("rejects outside-Ghana coordinates before creating a pending request", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      updateRequest({
        phone: "+233244123456",
        region_code: "accra",
        location: {
          latitude: 51.5072,
          longitude: -0.1276,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(prisma.alertAreaUpdateRequest.create).not.toHaveBeenCalled();
  });
});
