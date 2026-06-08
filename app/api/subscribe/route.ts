import { z } from "zod";
import { jsonError, handleApiError } from "@/lib/api-errors";
import {
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import { getPrisma } from "@/lib/prisma";
import { getRegionByCode } from "@/lib/regions";
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

const subscribeSchema = z.object({
  phone: z.string(),
  region_code: z.string(),
});

export async function POST(request: Request) {
  try {
    const payload = subscribeSchema.parse(await request.json());
    const phoneError = getGhanaPhoneValidationError(payload.phone);
    const phone = normalizeGhanaPhone(payload.phone);
    const region = getRegionByCode(payload.region_code);

    if (phoneError || !phone) {
      return jsonError(phoneError ?? "Invalid Ghana phone number.", 400);
    }

    if (!region) {
      return jsonError("Unknown region.", 400);
    }

    const prisma = getPrisma();
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { phone },
    });

    if (existingSubscriber?.active && existingSubscriber.verifiedAt) {
      return jsonError("Already subscribed.", 409);
    }

    const requestIp = getRequestIp(request);

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
          active: false,
        },
        update: {
          regionCode: region.code,
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
