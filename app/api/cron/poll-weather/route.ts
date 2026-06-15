import {
  createAlertMessage,
  evaluateAlertRisk,
  evaluateCatchmentAlertRisk,
} from "@/lib/alert-evaluator";
import { createAlertTargets } from "@/lib/alert-targets";
import type { AlertTarget } from "@/lib/alert-targets";
import { handleApiError, jsonError } from "@/lib/api-errors";
import { getPublicUnsubscribeUrl } from "@/lib/app-url";
import { getNumberEnv, requireEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { regions } from "@/lib/regions";
import { sendSms } from "@/lib/sms-dispatcher";
import { fetchPointForecast } from "@/lib/weather-client";

export const runtime = "nodejs";

type RegionPollResult = {
  region_code: string;
  target_code: string;
  target_kind: "region" | "forecast-zone" | "catchment";
  triggered: boolean;
  recipients: number;
  skipped_by_cooldown: boolean;
  reasons: string[];
};

async function evaluateTarget(target: AlertTarget) {
  if (target.kind !== "catchment") {
    const forecast = await fetchPointForecast(target.forecastPoint);

    return {
      evaluation: evaluateAlertRisk(target.evaluationRegion, forecast),
      weatherSnapshot: {
        hourly: forecast.hourly,
      },
    };
  }

  const forecasts = await Promise.all(
    target.forecastPoints.map(async (forecastPoint) => ({
      ...forecastPoint,
      forecast: await fetchPointForecast(forecastPoint.point),
    })),
  );

  return {
    evaluation: evaluateCatchmentAlertRisk(
      target.evaluationRegion,
      forecasts.map((forecastPoint) => ({
        name: forecastPoint.name,
        role: forecastPoint.role,
        forecast: forecastPoint.forecast,
      })),
    ),
    weatherSnapshot: {
      points: forecasts.map((forecastPoint) => ({
        name: forecastPoint.name,
        role: forecastPoint.role,
        point: forecastPoint.point,
        hourly: forecastPoint.forecast.hourly,
      })),
    },
  };
}

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
    const activeSubscribers = await prisma.subscriber.findMany({
      where: {
        active: true,
      },
      select: {
        phone: true,
        regionCode: true,
        forecastZoneCode: true,
        forecastLat: true,
        forecastLon: true,
      },
    });
    const targets = createAlertTargets(activeSubscribers);

    for (const target of targets) {
      const { evaluation, weatherSnapshot } = await evaluateTarget(target);
      const baseResult = {
        region_code: target.regionCode,
        target_code: target.code,
        target_kind: target.kind,
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
          regionCode: target.code,
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

      const phones = target.subscribers.map((subscriber) => subscriber.phone);

      if (phones.length > 0) {
        await sendSms({
          recipients: phones,
          message: createAlertMessage(
            target.displayName,
            evaluation,
            unsubscribeUrl,
            { kind: target.kind === "catchment" ? "catchment" : "weather" },
          ),
        });
        alertsSent += 1;
      }

      await prisma.alertLog.create({
        data: {
          regionCode: target.code,
          triggerReason: evaluation.reasons.join("; "),
          recipientsCount: phones.length,
          weatherSnapshot: {
            target: {
              code: target.code,
              kind: target.kind,
              regionCode: target.regionCode,
              displayName: target.displayName,
              forecastPoint: target.forecastPoint,
              forecastPoints: target.forecastPoints,
            },
            evaluation,
            ...weatherSnapshot,
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
      forecast_zones_checked: targets.filter(
        (target) => target.kind === "forecast-zone",
      ).length,
      catchments_checked: targets.filter((target) => target.kind === "catchment")
        .length,
      targets_checked: targets.length,
      alerts_sent: alertsSent,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
