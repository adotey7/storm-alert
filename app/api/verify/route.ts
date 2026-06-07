import { z } from "zod";
import { handleApiError, jsonError } from "@/lib/api-errors";
import {
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import { shouldUseArkeselOtp, verifyArkeselOtp } from "@/lib/arkesel-otp";
import { OTP_CODE_PATTERN } from "@/lib/otp-code";
import { hashOtpCode } from "@/lib/otp";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

const verifySchema = z.object({
  phone: z.string(),
  code: z.string().regex(OTP_CODE_PATTERN),
});

export async function POST(request: Request) {
  try {
    const payload = verifySchema.parse(await request.json());
    const phoneError = getGhanaPhoneValidationError(payload.phone);
    const phone = normalizeGhanaPhone(payload.phone);

    if (phoneError || !phone) {
      return jsonError(phoneError ?? "Invalid Ghana phone number.", 400);
    }

    const prisma = getPrisma();

    if (shouldUseArkeselOtp()) {
      const verified = await verifyArkeselOtp(phone, payload.code);

      if (!verified) {
        return jsonError("Invalid or expired OTP.", 400);
      }

      await prisma.otpCode.updateMany({
        where: {
          phone,
          used: false,
        },
        data: {
          used: true,
        },
      });

      const updateResult = await prisma.subscriber.updateMany({
        where: { phone },
        data: {
          active: true,
          verifiedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return jsonError("Subscribe before verifying this number.", 404);
      }

      return Response.json({ message: "Subscription verified." });
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
      return jsonError("Invalid or expired OTP.", 400);
    }

    await prisma.$transaction([
      prisma.otpCode.update({
        where: { id: otpCode.id },
        data: { used: true },
      }),
      prisma.subscriber.updateMany({
        where: { phone },
        data: {
          active: true,
          verifiedAt: new Date(),
        },
      }),
    ]);

    return Response.json({ message: "Subscription verified." });
  } catch (error) {
    return handleApiError(error);
  }
}
