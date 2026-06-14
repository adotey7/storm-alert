import { describe, expect, it } from "vitest";
import {
  createForecastZone,
  getForecastZoneCode,
  isWithinGhanaSupportedArea,
  normalizeLocationAccuracy,
} from "./location";

describe("location helpers", () => {
  it("accepts Ghana coordinates and rejects locations outside the coverage area", () => {
    expect(isWithinGhanaSupportedArea(5.6037, -0.187)).toBe(true);
    expect(isWithinGhanaSupportedArea(51.5072, -0.1276)).toBe(false);
    expect(isWithinGhanaSupportedArea(6.5244, 3.3792)).toBe(false);
  });

  it("rounds coordinates to a stable privacy-preserving forecast zone", () => {
    expect(createForecastZone(5.6037, -0.187)).toEqual({
      code: "gh-grid-p5p60-m0p20",
      lat: 5.6,
      lon: -0.2,
      gridSizeDegrees: 0.05,
    });
    expect(getForecastZoneCode(5.6, -0.2)).toBe("gh-grid-p5p60-m0p20");
  });

  it("does not create forecast zones outside Ghana coverage", () => {
    expect(createForecastZone(51.5072, -0.1276)).toBeNull();
  });

  it("normalizes browser accuracy to a bounded integer", () => {
    expect(normalizeLocationAccuracy(150.6)).toBe(151);
    expect(normalizeLocationAccuracy(-1)).toBeNull();
    expect(normalizeLocationAccuracy(250_000)).toBe(100_000);
  });
});
