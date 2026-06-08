import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertWithinRateLimits,
  clearRateLimitEvents,
  enforceRateLimits,
  getRequestIp,
  RATE_LIMIT_ACTIONS,
} from "./rate-limit";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    rateLimitEvent: {
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => prisma,
}));

function requestWithHeaders(headers: HeadersInit) {
  return new Request("https://example.com/api/test", { headers });
}

describe("rate limit helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.rateLimitEvent.count.mockResolvedValue(0);
    prisma.rateLimitEvent.createMany.mockResolvedValue({ count: 0 });
    prisma.rateLimitEvent.deleteMany.mockResolvedValue({ count: 0 });
    prisma.rateLimitEvent.findFirst.mockResolvedValue(null);
  });

  it("reads the first forwarded IP from proxy headers", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.7, 10.0.0.2",
    });

    expect(getRequestIp(request)).toBe("203.0.113.7");
  });

  it("falls back through common IP headers", () => {
    expect(
      getRequestIp(requestWithHeaders({ "x-real-ip": "198.51.100.4" })),
    ).toBe("198.51.100.4");
    expect(
      getRequestIp(requestWithHeaders({ "cf-connecting-ip": "192.0.2.10" })),
    ).toBe("192.0.2.10");
  });

  it("uses a stable unknown bucket when no IP headers exist", () => {
    expect(getRequestIp(requestWithHeaders({}))).toBe("unknown");
  });

  it("records rate limit events after checks pass", async () => {
    await enforceRateLimits([
      {
        action: RATE_LIMIT_ACTIONS.otpSendPhoneCooldown,
        identifier: "+233244123456",
        limit: 1,
        windowMs: 60_000,
        message: "Please wait a minute before requesting another code.",
      },
    ]);

    expect(prisma.rateLimitEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          action: RATE_LIMIT_ACTIONS.otpSendPhoneCooldown,
          identifier: "+233244123456",
        },
      ],
    });
  });

  it("throws with retry timing when a bucket is exhausted", async () => {
    const now = new Date("2026-06-08T12:00:00.000Z");
    prisma.rateLimitEvent.count.mockResolvedValue(1);
    prisma.rateLimitEvent.findFirst.mockResolvedValue({
      createdAt: new Date("2026-06-08T11:59:30.000Z"),
    });

    await expect(
      assertWithinRateLimits(
        [
          {
            action: RATE_LIMIT_ACTIONS.otpSendPhoneCooldown,
            identifier: "+233244123456",
            limit: 1,
            windowMs: 60_000,
            message: "Please wait a minute before requesting another code.",
          },
        ],
        now,
      ),
    ).rejects.toMatchObject({
      message: "Please wait a minute before requesting another code.",
      retryAfterSeconds: 30,
    });
  });

  it("clears only the supplied rate limit buckets", async () => {
    await clearRateLimitEvents([
      {
        action: RATE_LIMIT_ACTIONS.otpVerifyFailurePhone,
        identifier: "+233244123456",
      },
    ]);

    expect(prisma.rateLimitEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            action: RATE_LIMIT_ACTIONS.otpVerifyFailurePhone,
            identifier: "+233244123456",
          },
        ],
      },
    });
  });
});
