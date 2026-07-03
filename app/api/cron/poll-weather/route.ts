import {
  createAlertMessage,
  evaluateAlertRisk,
  evaluateCatchmentAlertRisk,
  type AlertEvaluation,
} from "@/lib/alert-evaluator";
import { createAlertTargets } from "@/lib/alert-targets";
import type { AlertTarget } from "@/lib/alert-targets";
import { handleApiError, jsonError } from "@/lib/api-errors";
import { getPublicUnsubscribeUrl } from "@/lib/app-url";
import { getNumberEnv, requireEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { regions } from "@/lib/regions";
import { sendSms } from "@/lib/sms-dispatcher";
import type { WeatherForecast } from "@/lib/weather-client";
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

type ForecastPointResult = AlertTarget["forecastPoints"][number] & {
  forecast: WeatherForecast;
};

function describeForecastError(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown forecast error.";
}

/**
 * Fetches every forecast point for a target with fault tolerance.
 *
 * Previous implementation awaited a bare `fetchPointForecast` for region and
 * forecast-zone targets. A single transient Open-Meteo failure (rate limit,
 * network reset) therefore threw out of the whole cron run and turned into a
 * 500 for the entire job. We now settle every point and degrade the affected
 * target instead of failing the run.
 */
async function fetchTargetForecasts(
  target: AlertTarget,
): Promise<{
  forecasts: ForecastPointResult[];
  failedPoints: Array<{
    name: string;
    role: "local" | "upstream";
    point: AlertTarget["forecastPoint"];
    error: string;
  }>;
}> {
  const results = await Promise.allSettled<ForecastPointResult>(
    target.forecastPoints.map(async (forecastPoint) => ({
      ...forecastPoint,
      forecast: await fetchPointForecast(forecastPoint.point),
    })),
  );
  const forecasts: ForecastPointResult[] = [];
  const failedPoints: Array<{
    name: string;
    role: "local" | "upstream";
    point: AlertTarget["forecastPoint"];
    error: string;
  }> = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      forecasts.push(result.value);
      return;
    }

    const forecastPoint = target.forecastPoints[index];
    failedPoints.push({
      name: forecastPoint.name,
      role: forecastPoint.role,
      point: forecastPoint.point,
      error: describeForecastError(result.reason),
    });
  });

  return { forecasts, failedPoints };
}

function degradedEvaluation(
  target: AlertTarget,
  failedPoints: Array<{
    name: string;
    role: "local" | "upstream";
    point: AlertTarget["forecastPoint"];
    error: string;
  }>,
): AlertEvaluation {
  const reasons = failedPoints.map(
    (failed) => `forecast unavailable for ${failed.name}: ${failed.error}`,
  );
  console.error(
    `[poll-weather] forecasts unavailable for target ${target.code}:`,
    failedPoints,
  );

  return {
    triggered: false,
    reasons,
    metrics: {
      maxPrecipitation1hMm: 0,
      maxPrecipitation3hMm: 0,
      maxPrecipitationProbability: 0,
      maxWindSpeedKmh: 0,
      matchedWeatherCodes: [],
    },
  };
}

async function evaluateTarget(target: AlertTarget) {
  const { forecasts, failedPoints } = await fetchTargetForecasts(target);

  if (forecasts.length === 0) {
    const evaluation = degradedEvaluation(target, failedPoints);

    return {
      evaluation,
      weatherSnapshot: {
        points: [],
        failedPoints,
      },
    };
  }

  if (target.kind === "catchment") {
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
        ...(failedPoints.length > 0 ? { failedPoints } : {}),
      },
    };
  }

  const [forecast] = forecasts;

  return {
    evaluation: evaluateAlertRisk(target.evaluationRegion, forecast.forecast),
    weatherSnapshot: {
      hourly: forecast.forecast.hourly,
      ...(failedPoints.length > 0 ? { failedPoints } : {}),
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
            {
              kind: target.kind === "catchment" ? "catchment" : "weather",
              catchmentWaterway:
                target.kind === "catchment"
                  ? target.catchmentWaterway
                  : undefined,
            },
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
              catchmentWaterway: target.catchmentWaterway,
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
    console.error("[poll-weather] cron run failed:", error);
    return handleApiError(error);
  }
}
