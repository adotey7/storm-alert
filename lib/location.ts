export const FORECAST_GRID_SIZE_DEGREES = 0.05;

const GHANA_SUPPORTED_BOUNDS = {
  minLat: 4.5,
  maxLat: 11.25,
  minLon: -3.35,
  maxLon: 1.35,
};

export type ForecastZone = {
  code: string;
  lat: number;
  lon: number;
  gridSizeDegrees: number;
};

export type SubscriberLocationInput = {
  latitude: number;
  longitude: number;
  accuracy_m?: number;
};

export function isWithinGhanaSupportedArea(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= GHANA_SUPPORTED_BOUNDS.minLat &&
    latitude <= GHANA_SUPPORTED_BOUNDS.maxLat &&
    longitude >= GHANA_SUPPORTED_BOUNDS.minLon &&
    longitude <= GHANA_SUPPORTED_BOUNDS.maxLon
  );
}

function roundToForecastGrid(
  value: number,
  gridSizeDegrees = FORECAST_GRID_SIZE_DEGREES,
): number {
  return Number((Math.round(value / gridSizeDegrees) * gridSizeDegrees).toFixed(2));
}

function formatCoordinatePart(value: number): string {
  const sign = value < 0 ? "m" : "p";
  return `${sign}${Math.abs(value).toFixed(2).replace(".", "p")}`;
}

export function getForecastZoneCode(latitude: number, longitude: number): string {
  return `gh-grid-${formatCoordinatePart(latitude)}-${formatCoordinatePart(
    longitude,
  )}`;
}

export function createForecastZone(
  latitude: number,
  longitude: number,
): ForecastZone | null {
  if (!isWithinGhanaSupportedArea(latitude, longitude)) {
    return null;
  }

  const lat = roundToForecastGrid(latitude);
  const lon = roundToForecastGrid(longitude);

  return {
    code: getForecastZoneCode(lat, lon),
    lat,
    lon,
    gridSizeDegrees: FORECAST_GRID_SIZE_DEGREES,
  };
}

export function normalizeLocationAccuracy(
  accuracyM: number | undefined,
): number | null {
  if (accuracyM === undefined || !Number.isFinite(accuracyM) || accuracyM < 0) {
    return null;
  }

  return Math.min(Math.round(accuracyM), 100_000);
}
