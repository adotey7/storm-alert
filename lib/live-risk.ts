import "server-only";

import {
  evaluateAlertRisk,
  evaluateCatchmentAlertRisk,
  type AlertEvaluation,
} from "@/lib/alert-evaluator";
import { type CatchmentConfig, catchments } from "@/lib/catchments";
import { deriveRiskLevel, type RiskLevel } from "@/lib/risk-level";
import { getRegionByCode, regions, type Region } from "@/lib/regions";
import {
  fetchPointForecast,
  type ForecastPoint,
  type WeatherForecast,
} from "@/lib/weather-client";

export const LIVE_RISK_REVALIDATE_SECONDS = 300;

export type RegionRiskSummary = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  level: RiskLevel;
  reasons: string[];
  metrics: AlertEvaluation["metrics"];
  evaluatedAt: string;
};

export type CatchmentUpstreamSummary = {
  name: string;
  lat: number;
  lon: number;
  level: RiskLevel;
};

export type CatchmentRiskSummary = {
  code: string;
  displayName: string;
  waterwayName: string;
  lat: number;
  lon: number;
  radiusKm: number;
  regionCode: string;
  level: RiskLevel;
  reasons: string[];
  upstream: CatchmentUpstreamSummary[];
  evaluatedAt: string;
};

export type LiveRiskSummary = {
  regions: RegionRiskSummary[];
  catchments: CatchmentRiskSummary[];
  evaluatedAt: string;
};

export type RegionDetail = {
  summary: RegionRiskSummary;
  forecast: WeatherForecast | null;
};

type CatchmentForecastSource = {
  name: string;
  role: "local" | "upstream";
  forecast: WeatherForecast;
};

/** Pure: shape a region's forecast into a UI summary. */
export function summarizeRegion(
  region: Region,
  forecast: WeatherForecast,
  evaluatedAt: string,
): RegionRiskSummary {
  const evaluation = evaluateAlertRisk(region, forecast);
  return {
    code: region.code,
    name: region.name,
    lat: region.lat,
    lon: region.lon,
    level: deriveRiskLevel(region, evaluation),
    reasons: evaluation.reasons,
    metrics: evaluation.metrics,
    evaluatedAt,
  };
}

/** Pure: shape catchment forecast sources into a UI summary. */
export function summarizeCatchment(
  catchment: CatchmentConfig,
  sources: CatchmentForecastSource[],
  upstream: CatchmentUpstreamSummary[],
  evaluatedAt: string,
): CatchmentRiskSummary {
  const region = getRegionByCode(catchment.regionCode);

  if (sources.length === 0 || !region) {
    return {
      code: catchment.code,
      displayName: catchment.displayName,
      waterwayName: catchment.waterwayName,
      lat: catchment.impactCenter.lat,
      lon: catchment.impactCenter.lon,
      radiusKm: catchment.impactRadiusKm,
      regionCode: catchment.regionCode,
      level: "unknown",
      reasons: ["forecast unavailable"],
      upstream: catchment.upstreamWatchPoints.map((point) => ({
        name: point.name,
        lat: point.lat,
        lon: point.lon,
        level: "unknown" as const,
      })),
      evaluatedAt,
    };
  }

  const evaluationRegion: Region = {
    ...region,
    code: catchment.code,
    name: catchment.displayName,
    lat: catchment.impactCenter.lat,
    lon: catchment.impactCenter.lon,
  };
  const evaluation = evaluateCatchmentAlertRisk(evaluationRegion, sources);

  return {
    code: catchment.code,
    displayName: catchment.displayName,
    waterwayName: catchment.waterwayName,
    lat: catchment.impactCenter.lat,
    lon: catchment.impactCenter.lon,
    radiusKm: catchment.impactRadiusKm,
    regionCode: catchment.regionCode,
    level: deriveRiskLevel(evaluationRegion, evaluation),
    reasons: evaluation.reasons,
    upstream,
    evaluatedAt,
  };
}

/** Builds the `unknown` summary shown when a region's forecast can't be fetched.
 *  Shared by getLiveRiskSummary's allSettled fallback and getRegionDetail's catch
 *  so both degrade identically. */
export function unknownRegionSummary(
  region: Region,
  evaluatedAt: string,
): RegionRiskSummary {
  return {
    code: region.code,
    name: region.name,
    lat: region.lat,
    lon: region.lon,
    level: "unknown",
    reasons: ["forecast unavailable"],
    metrics: {
      maxPrecipitation1hMm: 0,
      maxPrecipitation3hMm: 0,
      maxPrecipitationProbability: 0,
      maxWindSpeedKmh: 0,
      matchedWeatherCodes: [],
    },
    evaluatedAt,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Fetches forecasts for the catchment's local impact center and each upstream
 * watch point, then shapes the results into a UI summary. A single failed
 * fetch degrades only that point (an upstream point falls back to `unknown`;
 * an empty `sources` list makes the catchment `unknown`), never throws.
 */
async function evaluateCatchmentSummary(
  catchment: CatchmentConfig,
  evaluatedAt: string,
): Promise<CatchmentRiskSummary> {
  const region = getRegionByCode(catchment.regionCode);

  type FetchTarget = {
    name: string;
    role: "local" | "upstream";
    point: ForecastPoint;
    /** Pre-filled `unknown` placeholder; overwritten when the forecast lands. */
    upstream?: CatchmentUpstreamSummary;
  };

  const targets: FetchTarget[] = [
    {
      name: catchment.displayName,
      role: "local",
      point: catchment.impactCenter,
    },
    ...catchment.upstreamWatchPoints.map((watch) => ({
      name: watch.name,
      role: "upstream" as const,
      point: { lat: watch.lat, lon: watch.lon },
      upstream: {
        name: watch.name,
        lat: watch.lat,
        lon: watch.lon,
        level: "unknown" as const,
      },
    })),
  ];

  const results = await Promise.allSettled(
    targets.map((target) =>
      fetchPointForecast(target.point, {
        revalidate: LIVE_RISK_REVALIDATE_SECONDS,
      }),
    ),
  );

  const sources: CatchmentForecastSource[] = [];
  const upstream: CatchmentUpstreamSummary[] = [];

  results.forEach((result, index) => {
    const target = targets[index];

    if (result.status !== "fulfilled") {
      if (target.upstream) {
        upstream.push(target.upstream);
      }
      return;
    }

    sources.push({
      name: target.name,
      role: target.role,
      forecast: result.value,
    });

    if (target.upstream) {
      upstream.push({
        ...target.upstream,
        level: region
          ? deriveRiskLevel(region, evaluateAlertRisk(region, result.value))
          : "unknown",
      });
    }
  });

  return summarizeCatchment(catchment, sources, upstream, evaluatedAt);
}

export async function getLiveRiskSummary(): Promise<LiveRiskSummary> {
  const evaluatedAt = nowIso();

  const regionResults = await Promise.allSettled(
    regions.map(async (region) => ({
      region,
      forecast: await fetchPointForecast(
        { lat: region.lat, lon: region.lon },
        { revalidate: LIVE_RISK_REVALIDATE_SECONDS },
      ),
    })),
  );

  const regionSummaries: RegionRiskSummary[] = regionResults.map(
    (result, index) => {
      if (result.status === "fulfilled") {
        return summarizeRegion(
          result.value.region,
          result.value.forecast,
          evaluatedAt,
        );
      }
      const region = regions[index];
      return unknownRegionSummary(region, evaluatedAt);
    },
  );

  const catchmentSummaries = await Promise.all(
    catchments.map((catchment) => evaluateCatchmentSummary(catchment, evaluatedAt)),
  );

  return { regions: regionSummaries, catchments: catchmentSummaries, evaluatedAt };
}

export async function getRegionDetail(
  code: string,
): Promise<RegionDetail | null> {
  const region = getRegionByCode(code);
  if (!region) {
    return null;
  }

  try {
    const forecast = await fetchPointForecast(
      { lat: region.lat, lon: region.lon },
      { revalidate: LIVE_RISK_REVALIDATE_SECONDS },
    );
    return {
      summary: summarizeRegion(region, forecast, nowIso()),
      forecast,
    };
  } catch (error) {
    console.error(
      "[live-risk] getRegionDetail forecast failed; degrading to unknown:",
      error,
    );
    return {
      summary: unknownRegionSummary(region, nowIso()),
      forecast: null,
    };
  }
}
