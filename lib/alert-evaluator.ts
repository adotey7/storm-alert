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

  if (
    metrics.maxPrecipitation1hMm >= region.thresholds.precipitation_1h_mm
  ) {
    reasons.push(
      `1h rainfall ${metrics.maxPrecipitation1hMm}mm exceeds ${region.thresholds.precipitation_1h_mm}mm`,
    );
  }

  if (
    metrics.maxPrecipitation3hMm >= region.thresholds.precipitation_3h_mm
  ) {
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
    evaluation.reasons.map((reason) =>
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

export function createAlertMessage(
  regionName: string,
  evaluation: AlertEvaluation,
  unsubscribeUrl?: string,
  options: {
    kind?: "weather" | "catchment";
  } = {},
): string {
  const unsubscribeText = unsubscribeUrl ? ` Opt out: ${unsubscribeUrl}` : "";

  if (options.kind === "catchment") {
    return `StormAlert GH: Flood risk detected for ${regionName}. ${evaluation.reasons[0]}. Heavy upstream rain may affect Odaw/Dome Bridge drainage. Stay alert and avoid flood-prone areas.${unsubscribeText}`;
  }

  return `StormAlert GH: Weather risk detected for ${regionName}. ${evaluation.reasons[0]}. Stay alert and avoid flood-prone areas.${unsubscribeText}`;
}
