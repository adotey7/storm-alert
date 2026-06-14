import { z } from "zod";
import {
  generateArkeselOtp,
  shouldUseArkeselOtp,
} from "@/lib/arkesel-otp";
import { handleApiError, jsonError } from "@/lib/api-errors";
import {
  createOtpCode,
  getOtpExpiryDate,
  hashOtpCode,
} from "@/lib/otp";
import {
  createAlertAreaUpdateMessage,
  sendSms,
} from "@/lib/sms-dispatcher";
import {
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import {
  createForecastZone,
  normalizeLocationAccuracy,
} from "@/lib/location";
import { findNearestRegion, getRegionByCode } from "@/lib/regions";
import { getPrisma } from "@/lib/prisma";
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

const updateAlertAreaSchema = z.object({
  phone: z.string(),
  region_code: z.string(),
  location: locationSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const payload = updateAlertAreaSchema.parse(await request.json());
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
    const prisma = getPrisma();
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { phone },
      select: {
        active: true,
        verifiedAt: true,
      },
    });

    if (!existingSubscriber?.active || !existingSubscriber.verifiedAt) {
      return jsonError(
        "Subscribe and verify this number before updating alert area.",
        404,
      );
    }

    await enforceRateLimits([
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateAttemptPhone,
        identifier: phone,
        limit: 6,
        windowMs: 10 * 60_000,
        message: "Too many update attempts for this phone. Try again later.",
      },
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateAttemptIp,
        identifier: requestIp,
        limit: 20,
        windowMs: 10 * 60_000,
        message: "Too many update attempts. Try again later.",
      },
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateOtpSendPhoneCooldown,
        identifier: phone,
        limit: 1,
        windowMs: 60_000,
        message: "Please wait a minute before requesting another code.",
      },
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateOtpSendPhone,
        identifier: phone,
        limit: 3,
        windowMs: 30 * 60_000,
        message:
          "Too many update codes requested for this phone. Try again later.",
      },
      {
        action: RATE_LIMIT_ACTIONS.alertAreaUpdateOtpSendIp,
        identifier: requestIp,
        limit: 10,
        windowMs: 60 * 60_000,
        message: "Too many update code requests. Try again later.",
      },
    ]);

    const useArkeselOtp = shouldUseArkeselOtp();
    const code = useArkeselOtp ? "" : createOtpCode();
    const expiresAt = getOtpExpiryDate();
    const requestData = {
      phone,
      regionCode: region.code,
      forecastZoneCode: forecastZone?.code ?? null,
      forecastLat: forecastZone?.lat ?? null,
      forecastLon: forecastZone?.lon ?? null,
      locationAccuracyM,
      expiresAt,
    };

    await prisma.$transaction([
      prisma.alertAreaUpdateRequest.updateMany({
        where: {
          phone,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      prisma.alertAreaUpdateRequest.create({
        data: requestData,
      }),
      ...(useArkeselOtp
        ? []
        : [
            prisma.otpCode.updateMany({
              where: {
                phone,
                used: false,
              },
              data: {
                used: true,
              },
            }),
            prisma.otpCode.create({
              data: {
                phone,
                codeHash: hashOtpCode(phone, code),
                expiresAt,
              },
            }),
          ]),
    ]);

    if (useArkeselOtp) {
      const otp = await generateArkeselOtp(phone);

      return Response.json({
        message: "Check your phone for a code to update your alert area.",
        ussd_code: otp.ussdCode,
      });
    }

    const sms = await sendSms({
      recipients: [phone],
      message: createAlertAreaUpdateMessage(code),
    });

    return Response.json({
      message: sms.skipped
        ? "Update code generated. Configure Arkesel to send SMS."
        : "Check your phone for a code to update your alert area.",
      ...(sms.skipped && process.env.NODE_ENV !== "production"
        ? { dev_otp: code }
        : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
