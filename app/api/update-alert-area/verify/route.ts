import { z } from "zod";
import { shouldUseArkeselOtp, verifyArkeselOtp } from "@/lib/arkesel-otp";
import { handleApiError, jsonError } from "@/lib/api-errors";
import { hashOtpCode } from "@/lib/otp";
import { OTP_CODE_PATTERN } from "@/lib/otp-code";
import {
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import { getPrisma } from "@/lib/prisma";
import {
  assertWithinRateLimits,
  clearRateLimitEvents,
  getRequestIp,
  RATE_LIMIT_ACTIONS,
  recordRateLimitEvents,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const verifyAlertAreaSchema = z.object({
  phone: z.string(),
  code: z.string().regex(OTP_CODE_PATTERN),
});

export async function POST(request: Request) {
  try {
    const payload = verifyAlertAreaSchema.parse(await request.json());
    const phoneError = getGhanaPhoneValidationError(payload.phone);
    const phone = normalizeGhanaPhone(payload.phone);
    const requestIp = getRequestIp(request);

    if (phoneError || !phone) {
      return jsonError(phoneError ?? "Invalid Ghana phone number.", 400);
    }

    const prisma = getPrisma();
    const subscriber = await prisma.subscriber.findUnique({
      where: { phone },
      select: {
        active: true,
        verifiedAt: true,
      },
    });

    if (!subscriber?.active || !subscriber.verifiedAt) {
      return jsonError(
        "Subscribe and verify this number before updating alert area.",
        404,
      );
    }

    const updateRequest = await prisma.alertAreaUpdateRequest.findFirst({
      where: {
        phone,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!updateRequest) {
      return jsonError("Request a new update code first.", 404);
    }

    const verifyFailureEvents = [
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateVerifyFailurePhone,
        identifier: phone,
      },
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateVerifyFailureIp,
        identifier: requestIp,
      },
    ];
    const phoneVerifyFailureEvents = [
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateVerifyFailurePhone,
        identifier: phone,
      },
    ];

    await assertWithinRateLimits([
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateVerifyFailurePhone,
        identifier: phone,
        limit: 5,
        windowMs: 10 * 60_000,
        message: "Too many incorrect codes. Try again later.",
      },
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateVerifyFailureIp,
        identifier: requestIp,
        limit: 25,
        windowMs: 10 * 60_000,
        message: "Too many incorrect verification attempts. Try again later.",
      },
    ]);

    if (shouldUseArkeselOtp()) {
      const verified = await verifyArkeselOtp(phone, payload.code);

      if (!verified) {
        await recordRateLimitEvents(verifyFailureEvents);
        return jsonError("Invalid or expired OTP.", 400);
      }

      await prisma.$transaction([
        prisma.alertAreaUpdateRequest.update({
          where: { id: updateRequest.id },
          data: { consumedAt: new Date() },
        }),
        prisma.subscriber.update({
          where: { phone },
          data: {
            regionCode: updateRequest.regionCode,
            forecastZoneCode: updateRequest.forecastZoneCode,
            forecastLat: updateRequest.forecastLat,
            forecastLon: updateRequest.forecastLon,
            locationAccuracyM: updateRequest.locationAccuracyM,
          },
        }),
      ]);

      await clearRateLimitEvents(phoneVerifyFailureEvents);
      return Response.json({ message: "Alert area updated." });
    }

    const otpCode = await prisma.otpCode.findFirst({
      where: {
        phone,
        codeHash: hashOtpCode(phone, payload.code),
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpCode) {
      await recordRateLimitEvents(verifyFailureEvents);
      return jsonError("Invalid or expired OTP.", 400);
    }

    await prisma.$transaction([
      prisma.otpCode.update({
        where: { id: otpCode.id },
        data: { used: true },
      }),
      prisma.alertAreaUpdateRequest.update({
        where: { id: updateRequest.id },
        data: { consumedAt: new Date() },
      }),
      prisma.subscriber.update({
        where: { phone },
        data: {
          regionCode: updateRequest.regionCode,
          forecastZoneCode: updateRequest.forecastZoneCode,
          forecastLat: updateRequest.forecastLat,
          forecastLon: updateRequest.forecastLon,
          locationAccuracyM: updateRequest.locationAccuracyM,
        },
      }),
    ]);

    await clearRateLimitEvents(phoneVerifyFailureEvents);
    return Response.json({ message: "Alert area updated." });
  } catch (error) {
    return handleApiError(error);
  }
}
