import type { ForecastPoint } from "@/lib/weather-client";

export type CatchmentWatchPoint = ForecastPoint & {
  name: string;
};

export type CatchmentConfig = {
  code: string;
  displayName: string;
  regionCode: string;
  impactCenter: ForecastPoint;
  impactRadiusKm: number;
  upstreamWatchPoints: CatchmentWatchPoint[];
};

export const catchments = [
  {
    code: "odaw-christian-village",
    displayName: "Odaw/Dome Bridge drainage area",
    regionCode: "accra",
    impactCenter: {
      lat: 5.63333,
      lon: -0.21667,
    },
    impactRadiusKm: 3,
    upstreamWatchPoints: [
      { name: "Aburi Ridge", lat: 5.848, lon: -0.1745 },
      { name: "Ashongman", lat: 5.71056, lon: -0.23306 },
      { name: "Madina", lat: 5.6833, lon: -0.1667 },
    ],
  },
] satisfies CatchmentConfig[];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function getDistanceKm(pointA: ForecastPoint, pointB: ForecastPoint): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLon = toRadians(pointB.lon - pointA.lon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(pointA.lat)) *
      Math.cos(toRadians(pointB.lat)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findCatchmentForPoint(
  point: ForecastPoint,
  configuredCatchments = catchments,
): CatchmentConfig | undefined {
  return configuredCatchments.find(
    (catchment) =>
      getDistanceKm(point, catchment.impactCenter) <= catchment.impactRadiusKm,
  );
}
