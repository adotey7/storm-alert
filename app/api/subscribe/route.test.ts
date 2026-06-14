import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, sendSms } = vi.hoisted(() => ({
  prisma: {
    subscriber: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
  createOtpMessage: (code: string) =>
    `Your StormAlert GH verification code is ${code}. It expires soon.`,
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
    subscribeAttemptPhone: "subscribe_attempt_phone",
    subscribeAttemptIp: "subscribe_attempt_ip",
    otpSendPhoneCooldown: "otp_send_phone_cooldown",
    otpSendPhone: "otp_send_phone",
    otpSendIp: "otp_send_ip",
  },
}));

function subscribeRequest(body: unknown) {
  return new Request("https://storm-alert.example/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("subscribe route location handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.subscriber.findUnique.mockResolvedValue(null);
    prisma.subscriber.upsert.mockReturnValue({ query: "subscriber.upsert" });
    prisma.otpCode.updateMany.mockReturnValue({ query: "otpCode.updateMany" });
    prisma.otpCode.create.mockReturnValue({ query: "otpCode.create" });
    prisma.$transaction.mockResolvedValue([]);
    sendSms.mockResolvedValue({ sent: false, skipped: true });
  });

  it("stores rounded forecast zone fields for Ghana coordinates", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      subscribeRequest({
        phone: "+233244123456",
        region_code: "accra",
        location: {
          latitude: 5.6037,
          longitude: -0.187,
          accuracy_m: 150.4,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(prisma.subscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          regionCode: "accra",
          forecastZoneCode: "gh-grid-p5p60-m0p20",
          forecastLat: 5.6,
          forecastLon: -0.2,
          locationAccuracyM: 150,
        }),
        update: expect.objectContaining({
          forecastZoneCode: "gh-grid-p5p60-m0p20",
          forecastLat: 5.6,
          forecastLon: -0.2,
          locationAccuracyM: 150,
        }),
      }),
    );
  });

  it("rejects outside-Ghana coordinates before creating a subscriber", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      subscribeRequest({
        phone: "+233244123456",
        region_code: "accra",
        location: {
          latitude: 51.5072,
          longitude: -0.1276,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Ghana only");
    expect(prisma.subscriber.upsert).not.toHaveBeenCalled();
  });

  it("keeps manual region-only subscriptions without forecast zone fields", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      subscribeRequest({
        phone: "+233244123456",
        region_code: "kumasi",
      }),
    );

    expect(response.status).toBe(200);
    expect(prisma.subscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          regionCode: "kumasi",
          forecastZoneCode: null,
          forecastLat: null,
          forecastLon: null,
          locationAccuracyM: null,
        }),
      }),
    );
  });
});
