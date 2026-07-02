import { describe, expect, it } from "vitest";
import { createAlertTargets } from "./alert-targets";
import type { Region } from "./regions";

const testRegions: Region[] = [
  {
    code: "accra",
    name: "Greater Accra",
    lat: 5.6037,
    lon: -0.187,
    thresholds: {
      precipitation_1h_mm: 20,
      precipitation_3h_mm: 50,
      precipitation_probability: 85,
      wind_speed_kmh: 60,
      wmo_codes: [95],
    },
  },
  {
    code: "kumasi",
    name: "Ashanti",
    lat: 6.6885,
    lon: -1.6244,
    thresholds: {
      precipitation_1h_mm: 20,
      precipitation_3h_mm: 50,
      precipitation_probability: 85,
      wind_speed_kmh: 60,
      wmo_codes: [95],
    },
  },
];

describe("alert targets", () => {
  it("keeps coordinate subscribers in their rounded forecast zone", () => {
    const targets = createAlertTargets(
      [
        {
          phone: "+233244111111",
          regionCode: "accra",
          forecastZoneCode: "gh-grid-p5p60-m0p20",
          forecastLat: 5.6,
          forecastLon: -0.2,
        },
        {
          phone: "+233244222222",
          regionCode: "accra",
          forecastZoneCode: "gh-grid-p5p60-m0p20",
          forecastLat: 5.6,
          forecastLon: -0.2,
        },
        {
          phone: "+233244333333",
          regionCode: "accra",
          forecastZoneCode: null,
          forecastLat: null,
          forecastLon: null,
        },
      ],
      testRegions,
    );

    const accraTarget = targets.find((target) => target.code === "accra");
    const zoneTarget = targets.find(
      (target) => target.code === "gh-grid-p5p60-m0p20",
    );

    expect(accraTarget?.subscribers).toEqual([{ phone: "+233244333333" }]);
    expect(zoneTarget).toMatchObject({
      kind: "forecast-zone",
      displayName: "your area in Greater Accra",
      regionCode: "accra",
      forecastPoint: {
        lat: 5.6,
        lon: -0.2,
      },
    });
    expect(zoneTarget?.subscribers).toEqual([
      { phone: "+233244111111" },
      { phone: "+233244222222" },
    ]);
  });

  it("routes Christian Village coordinate subscribers into the Odaw catchment", () => {
    const targets = createAlertTargets(
      [
        {
          phone: "+233244111111",
          regionCode: "accra",
          forecastZoneCode: "gh-grid-p5p65-m0p20",
          forecastLat: 5.65,
          forecastLon: -0.2,
        },
        {
          phone: "+233244222222",
          regionCode: "accra",
          forecastZoneCode: "gh-grid-p5p65-m0p20",
          forecastLat: 5.65,
          forecastLon: -0.2,
        },
      ],
      testRegions,
    );

    const catchmentTarget = targets.find(
      (target) => target.code === "odaw-christian-village",
    );
    const zoneTarget = targets.find(
      (target) => target.code === "gh-grid-p5p65-m0p20",
    );

    expect(zoneTarget).toBeUndefined();
    expect(catchmentTarget).toMatchObject({
      kind: "catchment",
      displayName: "Odaw/Dome Bridge drainage area",
      catchmentWaterway: "Odaw/Dome Bridge",
      regionCode: "accra",
      subscribers: [
        { phone: "+233244111111" },
        { phone: "+233244222222" },
      ],
    });
    expect(catchmentTarget?.forecastPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Aburi Ridge", role: "upstream" }),
        expect.objectContaining({ name: "Ashongman", role: "upstream" }),
        expect.objectContaining({ name: "Madina", role: "upstream" }),
      ]),
    );
  });

  it("leaves coordinates outside the catchment as normal forecast zones", () => {
    const targets = createAlertTargets(
      [
        {
          phone: "+233244111111",
          regionCode: "accra",
          forecastZoneCode: "gh-grid-p5p60-m0p20",
          forecastLat: 5.6,
          forecastLon: -0.2,
        },
      ],
      testRegions,
    );

    expect(
      targets.find((target) => target.code === "odaw-christian-village"),
    ).toBeUndefined();
    expect(
      targets.find((target) => target.code === "gh-grid-p5p60-m0p20")?.kind,
    ).toBe("forecast-zone");
  });

  it("still creates region targets with empty subscriber lists", () => {
    const targets = createAlertTargets([], testRegions);

    expect(targets.map((target) => target.code)).toEqual(["accra", "kumasi"]);
    expect(targets.every((target) => target.kind === "region")).toBe(true);
  });
});
