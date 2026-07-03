import { describe, expect, it } from "vitest";
import { deriveRiskLevel, RISK_LEVEL_LABELS, type RiskLevel } from "./risk-level";
import type { AlertEvaluation } from "./alert-evaluator";
import type { Region } from "./regions";

const region: Region = {
  code: "test",
  name: "Test",
  lat: 5,
  lon: 0,
  thresholds: {
    precipitation_1h_mm: 20,
    precipitation_3h_mm: 50,
    precipitation_probability: 85,
    wind_speed_kmh: 60,
    wmo_codes: [61, 63, 65, 80, 81, 82, 95, 96, 99],
  },
};

const clear: AlertEvaluation = {
  triggered: false,
  reasons: [],
  metrics: {
    maxPrecipitation1hMm: 0,
    maxPrecipitation3hMm: 0,
    maxPrecipitationProbability: 10,
    maxWindSpeedKmh: 12,
    matchedWeatherCodes: [],
  },
};

describe("deriveRiskLevel", () => {
  it("returns warning when the evaluation is triggered", () => {
    expect(
      deriveRiskLevel(region, { ...clear, triggered: true, reasons: ["wind"] }),
    ).toBe("warning");
  });

  it("returns watch when precipitation probability is elevated (>=60) but not triggered", () => {
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, maxPrecipitationProbability: 65 },
      }),
    ).toBe("watch");
  });

  it("returns watch when any metric reaches half its threshold", () => {
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, maxPrecipitation1hMm: 11 },
      }),
    ).toBe("watch");
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, maxWindSpeedKmh: 35 },
      }),
    ).toBe("watch");
  });

  it("returns watch when a concerning weather code is present", () => {
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, matchedWeatherCodes: [61] },
      }),
    ).toBe("watch");
  });

  it("returns clear when nothing is elevated", () => {
    expect(deriveRiskLevel(region, clear)).toBe("clear");
  });

  it("labels every level", () => {
    const levels: RiskLevel[] = ["warning", "watch", "clear", "unknown"];
    for (const level of levels) {
      expect(RISK_LEVEL_LABELS[level]).toBeTruthy();
    }
  });
});
