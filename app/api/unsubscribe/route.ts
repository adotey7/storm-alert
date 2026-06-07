import { z } from "zod";
import { handleApiError, jsonError } from "@/lib/api-errors";
import {
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

const unsubscribeSchema = z.object({
  phone: z.string(),
});

export async function POST(request: Request) {
  try {
    const payload = unsubscribeSchema.parse(await request.json());
    const phoneError = getGhanaPhoneValidationError(payload.phone);
    const phone = normalizeGhanaPhone(payload.phone);

    if (phoneError || !phone) {
      return jsonError(phoneError ?? "Invalid Ghana phone number.", 400);
    }

    await getPrisma().subscriber.updateMany({
      where: { phone },
      data: { active: false },
    });

    return Response.json({ message: "Unsubscribed successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
