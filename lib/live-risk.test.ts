import { describe, expect, it } from "vitest";
import {
  summarizeRegion,
  summarizeCatchment,
} from "./live-risk";
import type { Region } from "./regions";
import type { WeatherForecast } from "./weather-client";
import { catchments } from "./catchments";

const region: Region = {
  code: "accra",
  name: "Greater Accra",
  lat: 5.6037,
  lon: -0.187,
  thresholds: {
    precipitation_1h_mm: 20,
    precipitation_3h_mm: 50,
    precipitation_probability: 85,
    wind_speed_kmh: 60,
    wmo_codes: [61, 63, 65, 80, 81, 82, 95, 96, 99],
  },
};

const evaluatedAt = "2026-07-03T12:00:00.000Z";

function forecast(
  overrides: Partial<WeatherForecast["hourly"]> = {},
): WeatherForecast {
  return {
    latitude: region.lat,
    longitude: region.lon,
    hourly: {
      time: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"],
      precipitation: [0, 0, 0, 0, 0, 0],
      precipitation_probability: [10, 10, 10, 10, 10, 10],
      wind_speed_10m: [10, 10, 10, 10, 10, 10],
      weather_code: [0, 0, 0, 0, 0, 0],
      ...overrides,
    },
  };
}

describe("summarizeRegion", () => {
  it("derives a clear level and copies coordinates", () => {
    const summary = summarizeRegion(region, forecast(), evaluatedAt);
    expect(summary.code).toBe("accra");
    expect(summary.lat).toBe(5.6037);
    expect(summary.lon).toBe(-0.187);
    expect(summary.level).toBe("clear");
    expect(summary.reasons).toEqual([]);
    expect(summary.evaluatedAt).toBe(evaluatedAt);
  });

  it("derives a warning level when triggered", () => {
    const summary = summarizeRegion(
      region,
      forecast({ precipitation: [25, 0, 0, 0, 0, 0] }),
      evaluatedAt,
    );
    expect(summary.level).toBe("warning");
    expect(summary.reasons.length).toBeGreaterThan(0);
    expect(summary.metrics.maxPrecipitation1hMm).toBe(25);
  });
});

describe("summarizeCatchment", () => {
  const catchment = catchments[0];

  it("returns unknown when no forecast sources are available", () => {
    const summary = summarizeCatchment(catchment, [], [], evaluatedAt);
    expect(summary.level).toBe("unknown");
    expect(summary.reasons).toContain("forecast unavailable");
    expect(summary.upstream).toHaveLength(catchment.upstreamWatchPoints.length);
    expect(summary.upstream.every((u) => u.level === "unknown")).toBe(true);
  });

  it("derives a warning level from upstream heavy rain", () => {
    const sources = [
      {
        name: catchment.displayName,
        role: "local" as const,
        forecast: forecast(),
      },
      {
        name: "Aburi Ridge",
        role: "upstream" as const,
        forecast: forecast({ precipitation: [25, 0, 0, 0, 0, 0] }),
      },
    ];
    const upstream = [
      { name: "Aburi Ridge", lat: 5.848, lon: -0.1745, level: "warning" as const },
    ];
    const summary = summarizeCatchment(catchment, sources, upstream, evaluatedAt);
    expect(summary.level).toBe("warning");
    expect(summary.reasons.some((r) => r.startsWith("upstream"))).toBe(true);
  });
});
