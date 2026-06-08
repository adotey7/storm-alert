import "server-only";

import { getPrisma } from "@/lib/prisma";

const ONE_DAY_MS = 24 * 60 * 60_000;

export const RATE_LIMIT_ACTIONS = {
  otpSendIp: "otp_send_ip",
  otpSendPhone: "otp_send_phone",
  otpSendPhoneCooldown: "otp_send_phone_cooldown",
  otpVerifyFailureIp: "otp_verify_failure_ip",
  otpVerifyFailurePhone: "otp_verify_failure_phone",
  unsubscribeIp: "unsubscribe_ip",
  unsubscribePhone: "unsubscribe_phone",
  webhookIp: "webhook_ip",
} as const;

export type RateLimitAction =
  (typeof RATE_LIMIT_ACTIONS)[keyof typeof RATE_LIMIT_ACTIONS];

export type RateLimitCheck = {
  action: RateLimitAction;
  identifier: string;
  limit: number;
  windowMs: number;
  message: string;
};

export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

function getWindowStart(now: Date, windowMs: number): Date {
  return new Date(now.getTime() - windowMs);
}

function getRetryAfterSeconds(oldestEventDate: Date, now: Date, windowMs: number) {
  const retryAt = oldestEventDate.getTime() + windowMs;
  return Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000));
}

function normalizeIpCandidate(value: string | null): string | undefined {
  const candidate = value?.split(",")[0]?.trim();
  return candidate || undefined;
}

export function getRequestIp(request: Request): string {
  return (
    normalizeIpCandidate(request.headers.get("x-forwarded-for")) ??
    normalizeIpCandidate(request.headers.get("x-real-ip")) ??
    normalizeIpCandidate(request.headers.get("cf-connecting-ip")) ??
    "unknown"
  );
}

export async function assertWithinRateLimits(
  checks: RateLimitCheck[],
  now = new Date(),
): Promise<void> {
  const prisma = getPrisma();

  await prisma.rateLimitEvent.deleteMany({
    where: {
      createdAt: {
        lt: getWindowStart(now, ONE_DAY_MS),
      },
    },
  });

  for (const check of checks) {
    const windowStart = getWindowStart(now, check.windowMs);
    const [count, oldestEvent] = await Promise.all([
      prisma.rateLimitEvent.count({
        where: {
          action: check.action,
          identifier: check.identifier,
          createdAt: {
            gte: windowStart,
          },
        },
      }),
      prisma.rateLimitEvent.findFirst({
        where: {
          action: check.action,
          identifier: check.identifier,
          createdAt: {
            gte: windowStart,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    if (count >= check.limit) {
      throw new RateLimitExceededError(
        check.message,
        oldestEvent
          ? getRetryAfterSeconds(oldestEvent.createdAt, now, check.windowMs)
          : Math.ceil(check.windowMs / 1000),
      );
    }
  }
}

export async function enforceRateLimits(
  checks: RateLimitCheck[],
): Promise<void> {
  await assertWithinRateLimits(checks);

  await getPrisma().rateLimitEvent.createMany({
    data: checks.map((check) => ({
      action: check.action,
      identifier: check.identifier,
    })),
  });
}

export async function recordRateLimitEvents(
  events: Pick<RateLimitCheck, "action" | "identifier">[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await getPrisma().rateLimitEvent.createMany({
    data: events.map((event) => ({
      action: event.action,
      identifier: event.identifier,
    })),
  });
}

export async function clearRateLimitEvents(
  events: Pick<RateLimitCheck, "action" | "identifier">[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await getPrisma().rateLimitEvent.deleteMany({
    where: {
      OR: events.map((event) => ({
        action: event.action,
        identifier: event.identifier,
      })),
    },
  });
}
