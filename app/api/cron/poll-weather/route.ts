import { createAlertMessage, evaluateAlertRisk } from "@/lib/alert-evaluator";
import { handleApiError, jsonError } from "@/lib/api-errors";
import { getPublicUnsubscribeUrl } from "@/lib/app-url";
import { getNumberEnv, requireEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { regions } from "@/lib/regions";
import { sendSms } from "@/lib/sms-dispatcher";
import { fetchRegionForecast } from "@/lib/weather-client";

export const runtime = "nodejs";

type RegionPollResult = {
  region_code: string;
  triggered: boolean;
  recipients: number;
  skipped_by_cooldown: boolean;
  reasons: string[];
};

function unauthorized(): Response {
  return jsonError("Unauthorized.", 401);
}

export async function GET(request: Request) {
  try {
    const cronSecret = requireEnv("CRON_SECRET");

    if (request.headers.get("x-cron-secret") !== cronSecret) {
      return unauthorized();
    }

    const prisma = getPrisma();
    const cooldownHours = getNumberEnv("ALERT_COOLDOWN_HOURS", 6);
    const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60_000);
    const results: RegionPollResult[] = [];
    let alertsSent = 0;
    const unsubscribeUrl = getPublicUnsubscribeUrl();

    for (const region of regions) {
      const forecast = await fetchRegionForecast(region);
      const evaluation = evaluateAlertRisk(region, forecast);
      const baseResult = {
        region_code: region.code,
        triggered: evaluation.triggered,
        recipients: 0,
        skipped_by_cooldown: false,
        reasons: evaluation.reasons,
      };

      if (!evaluation.triggered) {
        results.push(baseResult);
        continue;
      }

      const recentAlert = await prisma.alertLog.findFirst({
        where: {
          regionCode: region.code,
          triggeredAt: {
            gte: cooldownCutoff,
          },
        },
        orderBy: {
          triggeredAt: "desc",
        },
      });

      if (recentAlert) {
        results.push({ ...baseResult, skipped_by_cooldown: true });
        continue;
      }

      const subscribers = await prisma.subscriber.findMany({
        where: {
          regionCode: region.code,
          active: true,
        },
        select: {
          phone: true,
        },
      });
      const phones = subscribers.map((subscriber) => subscriber.phone);

      if (phones.length > 0) {
        await sendSms({
          recipients: phones,
          message: createAlertMessage(region.name, evaluation, unsubscribeUrl),
        });
        alertsSent += 1;
      }

      await prisma.alertLog.create({
        data: {
          regionCode: region.code,
          triggerReason: evaluation.reasons.join("; "),
          recipientsCount: phones.length,
          weatherSnapshot: {
            evaluation,
            hourly: forecast.hourly,
          },
        },
      });

      results.push({
        ...baseResult,
        recipients: phones.length,
      });
    }

    return Response.json({
      regions_checked: regions.length,
      alerts_sent: alertsSent,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
