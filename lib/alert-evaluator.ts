import { getWmoCodeMeta } from "@/lib/wmo-code-meta";
import type { Region } from "@/lib/regions";
import type { WeatherForecast } from "@/lib/weather-client";

export type AlertEvaluation = {
  triggered: boolean;
  reasons: string[];
  metrics: {
    maxPrecipitation1hMm: number;
    maxPrecipitation3hMm: number;
    maxPrecipitationProbability: number;
    maxWindSpeedKmh: number;
    matchedWeatherCodes: number[];
  };
};

export type AlertForecastSource = {
  name: string;
  role: "local" | "upstream";
  forecast: WeatherForecast;
};

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function maxRollingSum(values: number[], windowSize: number): number {
  if (values.length === 0) {
    return 0;
  }

  let best = 0;

  for (let index = 0; index < values.length; index += 1) {
    const total = values
      .slice(index, index + windowSize)
      .reduce((sum, value) => sum + value, 0);
    best = Math.max(best, total);
  }

  return best;
}

export function evaluateAlertRisk(
  region: Region,
  forecast: WeatherForecast,
  horizonHours = 6,
): AlertEvaluation {
  const precipitation = forecast.hourly.precipitation.slice(0, horizonHours);
  const precipitationProbability =
    forecast.hourly.precipitation_probability.slice(0, horizonHours);
  const windSpeed = forecast.hourly.wind_speed_10m.slice(0, horizonHours);
  const weatherCodes = forecast.hourly.weather_code.slice(0, horizonHours);
  const matchedWeatherCodes = [
    ...new Set(
      weatherCodes.filter((code) => region.thresholds.wmo_codes.includes(code)),
    ),
  ];
  const metrics = {
    maxPrecipitation1hMm: max(precipitation),
    maxPrecipitation3hMm: maxRollingSum(precipitation, 3),
    maxPrecipitationProbability: max(precipitationProbability),
    maxWindSpeedKmh: max(windSpeed),
    matchedWeatherCodes,
  };
  const reasons: string[] = [];

  if (metrics.maxPrecipitation1hMm >= region.thresholds.precipitation_1h_mm) {
    reasons.push(
      `1h rainfall ${metrics.maxPrecipitation1hMm}mm exceeds ${region.thresholds.precipitation_1h_mm}mm`,
    );
  }

  if (metrics.maxPrecipitation3hMm >= region.thresholds.precipitation_3h_mm) {
    reasons.push(
      `3h rainfall ${metrics.maxPrecipitation3hMm}mm exceeds ${region.thresholds.precipitation_3h_mm}mm`,
    );
  }

  if (
    metrics.maxPrecipitationProbability >=
    region.thresholds.precipitation_probability
  ) {
    reasons.push(
      `rain probability ${metrics.maxPrecipitationProbability}% exceeds ${region.thresholds.precipitation_probability}%`,
    );
  }

  if (metrics.maxWindSpeedKmh >= region.thresholds.wind_speed_kmh) {
    reasons.push(
      `wind speed ${metrics.maxWindSpeedKmh}km/h exceeds ${region.thresholds.wind_speed_kmh}km/h`,
    );
  }

  if (matchedWeatherCodes.length > 0) {
    reasons.push(`weather code match: ${matchedWeatherCodes.join(", ")}`);
  }

  return {
    triggered: reasons.length > 0,
    reasons,
    metrics,
  };
}

function mergeMetrics(
  evaluations: AlertEvaluation[],
): AlertEvaluation["metrics"] {
  return {
    maxPrecipitation1hMm: max(
      evaluations.map((evaluation) => evaluation.metrics.maxPrecipitation1hMm),
    ),
    maxPrecipitation3hMm: max(
      evaluations.map((evaluation) => evaluation.metrics.maxPrecipitation3hMm),
    ),
    maxPrecipitationProbability: max(
      evaluations.map(
        (evaluation) => evaluation.metrics.maxPrecipitationProbability,
      ),
    ),
    maxWindSpeedKmh: max(
      evaluations.map((evaluation) => evaluation.metrics.maxWindSpeedKmh),
    ),
    matchedWeatherCodes: [
      ...new Set(
        evaluations.flatMap(
          (evaluation) => evaluation.metrics.matchedWeatherCodes,
        ),
      ),
    ],
  };
}

function isFloodRelevantReason(reason: string): boolean {
  return !reason.startsWith("wind speed ");
}

export function evaluateCatchmentAlertRisk(
  region: Region,
  sources: AlertForecastSource[],
  horizonHours = 6,
): AlertEvaluation {
  const sourceEvaluations = sources.map((source) => ({
    source,
    evaluation: evaluateAlertRisk(region, source.forecast, horizonHours),
  }));
  const reasons = sourceEvaluations.flatMap(({ source, evaluation }) =>
    evaluation.reasons
      .filter(isFloodRelevantReason)
      .map((reason) =>
        source.role === "upstream"
          ? `upstream ${source.name}: ${reason}`
          : `local ${source.name}: ${reason}`,
      ),
  );

  return {
    triggered: reasons.length > 0,
    reasons,
    metrics: mergeMetrics(
      sourceEvaluations.map(({ evaluation }) => evaluation),
    ),
  };
}

type AlertCategory = "rain" | "thunderstorm" | "wind" | "probability";

/**
 * Translates a technical reason string (used for DB logging) into a
 * plain-language summary suitable for SMS subscribers.
 *
 * Reason formats produced by evaluateAlertRisk / evaluateCatchmentAlertRisk:
 *   "1h rainfall 24mm exceeds 20mm"
 *   "3h rainfall 52mm exceeds 50mm"
 *   "rain probability 85% exceeds 80%"
 *   "wind speed 61km/h exceeds 60km/h"
 *   "weather code match: 95, 96"
 *   "upstream Aburi Ridge: 1h rainfall 24mm exceeds 20mm"
 *   "local Odaw: 3h rainfall 52mm exceeds 50mm"
 */
function toUserFriendlyReason(reason: string): {
  text: string;
  category: AlertCategory;
} {
  // Catchment reasons are prefixed with "upstream <name>:" or "local <name>:".
  const catchmentMatch = reason.match(/^(?:upstream|local)\s+(.+?):\s+(.+)$/);
  const location = catchmentMatch?.[1];
  const coreReason = catchmentMatch?.[2] ?? reason;
  const isUpstream = reason.startsWith("upstream ");

  const locationPrefix = location
    ? isUpstream
      ? `upstream (${location})`
      : `locally (${location})`
    : "";

  // 1h rainfall: "1h rainfall 24mm exceeds 20mm"
  let match = coreReason.match(/^1h rainfall ([\d.]+)mm exceeds (\d+)mm$/);
  if (match) {
    const mm = match[1];
    const text = locationPrefix
      ? `Heavy rain ${locationPrefix} (${mm}mm in 1 hour)`
      : `Heavy rain expected (${mm}mm in 1 hour)`;
    return { text, category: "rain" };
  }

  // 3h rainfall: "3h rainfall 52mm exceeds 50mm"
  match = coreReason.match(/^3h rainfall ([\d.]+)mm exceeds (\d+)mm$/);
  if (match) {
    const mm = match[1];
    const text = locationPrefix
      ? `Very heavy rain ${locationPrefix} (${mm}mm over 3 hours)`
      : `Very heavy rain expected (${mm}mm over 3 hours)`;
    return { text, category: "rain" };
  }

  // Rain probability: "rain probability 85% exceeds 80%"
  match = coreReason.match(/^rain probability (\d+)% exceeds (\d+)%$/);
  if (match) {
    const pct = match[1];
    const text = locationPrefix
      ? `Rain likely ${locationPrefix} (${pct}% chance)`
      : `Rain likely (${pct}% chance)`;
    return { text, category: "probability" };
  }

  // Wind speed: "wind speed 61km/h exceeds 60km/h"
  match = coreReason.match(/^wind speed ([\d.]+)km\/h exceeds (\d+)km\/h$/);
  if (match) {
    const kmh = match[1];
    const text = `Strong winds expected (up to ${kmh} km/h)`;
    return { text, category: "wind" };
  }

  // Weather code match: "weather code match: 95, 96"
  match = coreReason.match(/^weather code match:\s*([\d, ]+)$/);
  if (match) {
    const codes = match[1]
      .split(",")
      .map((c) => Number.parseInt(c.trim(), 10))
      .filter((c) => !Number.isNaN(c));
    const labels = codes.map((c) => getWmoCodeMeta(c).label);
    const label = labels.length > 0 ? labels.join(", ") : "Severe weather";
    const isThunderstorm = codes.some((c) => c >= 95);
    const text = locationPrefix
      ? isThunderstorm
        ? `Thunderstorm ${locationPrefix}`
        : `${label} ${locationPrefix}`
      : `${label} expected`;
    return { text, category: isThunderstorm ? "thunderstorm" : "rain" };
  }

  // Fallback: return the raw reason (shouldn't normally happen).
  return { text: reason, category: "rain" };
}

function safetyGuidance(category: AlertCategory): string {
  switch (category) {
    case "thunderstorm":
      return "Stay indoors and avoid open areas.";
    case "wind":
      return "Secure loose objects and stay indoors if possible.";
    case "probability":
      return "Prepare for possible flooding in low-lying areas.";
    case "rain":
    default:
      return "Avoid flood-prone areas and stay indoors if possible.";
  }
}

export function createAlertMessage(
  regionName: string,
  evaluation: AlertEvaluation,
  unsubscribeUrl?: string,
  options: {
    kind?: "weather" | "catchment";
    catchmentWaterway?: string;
  } = {},
): string {
  const unsubscribeText = unsubscribeUrl
    ? ` Stop alerts: ${unsubscribeUrl}`
    : "";

  if (options.kind === "catchment") {
    const waterway = options.catchmentWaterway ?? regionName;
    const { text, category } = toUserFriendlyReason(evaluation.reasons[0]);
    const guidance =
      category === "thunderstorm"
        ? "Move to higher ground and avoid crossing flooded roads."
        : "Move to higher ground and avoid crossing flooded roads.";

    return `StormAlert GH: Flood alert for ${waterway} area. ${text} may cause flooding. ${guidance}${unsubscribeText}`;
  }

  const { text, category } = toUserFriendlyReason(evaluation.reasons[0]);
  const guidance = safetyGuidance(category);

  return `StormAlert GH: Weather alert for ${regionName}. ${text}. ${guidance}${unsubscribeText}`;
}
