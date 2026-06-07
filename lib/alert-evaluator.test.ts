import { describe, expect, it } from "vitest";
import { createAlertMessage, evaluateAlertRisk } from "./alert-evaluator";
import type { Region } from "./regions";
import type { WeatherForecast } from "./weather-client";

const testRegion: Region = {
  code: "test",
  name: "Test Region",
  lat: 5,
  lon: 0,
  thresholds: {
    precipitation_1h_mm: 20,
    precipitation_3h_mm: 50,
    precipitation_probability: 85,
    wind_speed_kmh: 60,
    wmo_codes: [95],
  },
};

function createForecast(overrides: Partial<WeatherForecast["hourly"]> = {}) {
  return {
    latitude: testRegion.lat,
    longitude: testRegion.lon,
    hourly: {
      time: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"],
      precipitation: [0, 1, 2, 1, 0, 0],
      precipitation_probability: [10, 20, 30, 20, 10, 0],
      wind_speed_10m: [10, 12, 14, 12, 10, 8],
      weather_code: [1, 2, 3, 2, 1, 0],
      ...overrides,
    },
  } satisfies WeatherForecast;
}

describe("alert evaluator", () => {
  it("does not trigger when forecast values are below regional thresholds", () => {
    const evaluation = evaluateAlertRisk(testRegion, createForecast());

    expect(evaluation.triggered).toBe(false);
    expect(evaluation.reasons).toEqual([]);
    expect(evaluation.metrics.maxPrecipitation3hMm).toBe(4);
  });

  it("triggers when any threshold is crossed within the horizon", () => {
    const evaluation = evaluateAlertRisk(
      testRegion,
      createForecast({
        precipitation: [10, 18, 24, 2, 0, 0],
        precipitation_probability: [10, 20, 90, 20, 10, 0],
        weather_code: [1, 2, 95, 2, 1, 0],
      }),
    );

    expect(evaluation.triggered).toBe(true);
    expect(evaluation.metrics.maxPrecipitation1hMm).toBe(24);
    expect(evaluation.metrics.maxPrecipitation3hMm).toBe(52);
    expect(evaluation.metrics.matchedWeatherCodes).toEqual([95]);
    expect(evaluation.reasons).toEqual(
      expect.arrayContaining([
        "1h rainfall 24mm exceeds 20mm",
        "3h rainfall 52mm exceeds 50mm",
        "rain probability 90% exceeds 85%",
        "weather code match: 95",
      ]),
    );
  });

  it("creates a concise subscriber alert message from the first reason", () => {
    const evaluation = evaluateAlertRisk(
      testRegion,
      createForecast({ wind_speed_10m: [12, 61, 14, 12, 10, 8] }),
    );

    expect(createAlertMessage("Greater Accra", evaluation)).toContain(
      "StormAlert GH: Weather risk detected for Greater Accra.",
    );
    expect(createAlertMessage("Greater Accra", evaluation)).toContain(
      "wind speed 61km/h exceeds 60km/h",
    );
  });
});
