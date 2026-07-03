import type { AlertEvaluation } from "@/lib/alert-evaluator";
import type { Region } from "@/lib/regions";

export type RiskLevel = "warning" | "watch" | "clear" | "unknown";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  warning: "Warning",
  watch: "Watch",
  clear: "Clear",
  unknown: "Unknown",
};

const WATCH_PROBABILITY = 60;
const HALF_THRESHOLD = 0.5;

/**
 * Maps an alert evaluation to a coarse risk level for UI display.
 *
 * Returns `warning` when the evaluator triggered, `watch` when metrics are
 * elevated but below trigger thresholds, or `clear` otherwise. It never
 * returns `unknown` — callers set that when a forecast fetch failed and no
 * evaluation is available.
 */
export function deriveRiskLevel(
  region: Region,
  evaluation: AlertEvaluation,
): Exclude<RiskLevel, "unknown"> {
  if (evaluation.triggered) {
    return "warning";
  }

  const { thresholds } = region;
  const { metrics } = evaluation;

  const elevatedProbability = metrics.maxPrecipitationProbability >= WATCH_PROBABILITY;
  const halfOf1h =
    metrics.maxPrecipitation1hMm >= thresholds.precipitation_1h_mm * HALF_THRESHOLD;
  const halfOf3h =
    metrics.maxPrecipitation3hMm >= thresholds.precipitation_3h_mm * HALF_THRESHOLD;
  const halfOfWind =
    metrics.maxWindSpeedKmh >= thresholds.wind_speed_kmh * HALF_THRESHOLD;
  const concerningWeatherCode = metrics.matchedWeatherCodes.length > 0;

  if (
    elevatedProbability ||
    halfOf1h ||
    halfOf3h ||
    halfOfWind ||
    concerningWeatherCode
  ) {
    return "watch";
  }

  return "clear";
}
