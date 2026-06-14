import { z } from "zod";
import { jsonError, handleApiError } from "@/lib/api-errors";
import {
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import { getPrisma } from "@/lib/prisma";
import { findNearestRegion, getRegionByCode } from "@/lib/regions";
import {
  createForecastZone,
  normalizeLocationAccuracy,
} from "@/lib/location";
import {
  generateArkeselOtp,
  shouldUseArkeselOtp,
} from "@/lib/arkesel-otp";
import {
  createOtpCode,
  getOtpExpiryDate,
  hashOtpCode,
} from "@/lib/otp";
import { createOtpMessage, sendSms } from "@/lib/sms-dispatcher";
import {
  enforceRateLimits,
  getRequestIp,
  RATE_LIMIT_ACTIONS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const locationSchema = z.object({
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
  accuracy_m: z.number().finite().nonnegative().max(100_000).optional(),
});

const subscribeSchema = z.object({
  phone: z.string(),
  region_code: z.string(),
  location: locationSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const payload = subscribeSchema.parse(await request.json());
    const phoneError = getGhanaPhoneValidationError(payload.phone);
    const phone = normalizeGhanaPhone(payload.phone);
    const selectedRegion = getRegionByCode(payload.region_code);

    if (phoneError || !phone) {
      return jsonError(phoneError ?? "Invalid Ghana phone number.", 400);
    }

    if (!selectedRegion) {
      return jsonError("Unknown region.", 400);
    }

    const forecastZone = payload.location
      ? createForecastZone(payload.location.latitude, payload.location.longitude)
      : null;

    if (payload.location && !forecastZone) {
      return jsonError(
        "Location alerts currently support Ghana only. Choose a Ghana region manually if you are outside Ghana.",
        400,
      );
    }

    const region = payload.location
      ? findNearestRegion(payload.location.latitude, payload.location.longitude) ??
        selectedRegion
      : selectedRegion;
    const locationAccuracyM = payload.location
      ? normalizeLocationAccuracy(payload.location.accuracy_m)
      : null;
    const requestIp = getRequestIp(request);

    await enforceRateLimits([
      {
        action: RATE_LIMIT_ACTIONS.subscribeAttemptPhone,
        identifier: phone,
        limit: 10,
        windowMs: 10 * 60_000,
        message:
          "Too many subscription attempts for this phone. Try again later.",
      },
      {
        action: RATE_LIMIT_ACTIONS.subscribeAttemptIp,
        identifier: requestIp,
        limit: 30,
        windowMs: 10 * 60_000,
        message: "Too many subscription attempts. Try again later.",
      },
    ]);

    const prisma = getPrisma();
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { phone },
    });

    if (existingSubscriber?.active && existingSubscriber.verifiedAt) {
      return jsonError("Already subscribed.", 409);
    }

    await enforceRateLimits([
      {
        action: RATE_LIMIT_ACTIONS.otpSendPhoneCooldown,
        identifier: phone,
        limit: 1,
        windowMs: 60_000,
        message: "Please wait a minute before requesting another code.",
      },
      {
        action: RATE_LIMIT_ACTIONS.otpSendPhone,
        identifier: phone,
        limit: 3,
        windowMs: 30 * 60_000,
        message:
          "Too many verification codes requested for this phone. Try again later.",
      },
      {
        action: RATE_LIMIT_ACTIONS.otpSendIp,
        identifier: requestIp,
        limit: 10,
        windowMs: 60 * 60_000,
        message: "Too many verification requests. Try again later.",
      },
    ]);

    const useArkeselOtp = shouldUseArkeselOtp();
    const code = useArkeselOtp ? "" : createOtpCode();
    const expiresAt = useArkeselOtp ? null : getOtpExpiryDate();

    await prisma.$transaction([
      prisma.subscriber.upsert({
        where: { phone },
        create: {
          phone,
          regionCode: region.code,
          forecastZoneCode: forecastZone?.code ?? null,
          forecastLat: forecastZone?.lat ?? null,
          forecastLon: forecastZone?.lon ?? null,
          locationAccuracyM,
          active: false,
        },
        update: {
          regionCode: region.code,
          forecastZoneCode: forecastZone?.code ?? null,
          forecastLat: forecastZone?.lat ?? null,
          forecastLon: forecastZone?.lon ?? null,
          locationAccuracyM,
          active: false,
          verifiedAt: null,
        },
      }),
      prisma.otpCode.updateMany({
        where: {
          phone,
          used: false,
        },
        data: {
          used: true,
        },
      }),
      ...(useArkeselOtp
        ? []
        : [
            prisma.otpCode.create({
              data: {
                phone,
                codeHash: hashOtpCode(phone, code),
                expiresAt: expiresAt ?? getOtpExpiryDate(),
              },
            }),
          ]),
    ]);

    if (useArkeselOtp) {
      const otp = await generateArkeselOtp(phone);

      return Response.json({
        message: "Check your phone for a verification code.",
        ussd_code: otp.ussdCode,
      });
    }

    const sms = await sendSms({
      recipients: [phone],
      message: createOtpMessage(code),
    });

    return Response.json({
      message: sms.skipped
        ? "Verification code generated. Configure Arkesel to send SMS."
        : "Check your phone for a verification code.",
      ...(sms.skipped && process.env.NODE_ENV !== "production"
        ? { dev_otp: code }
        : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
