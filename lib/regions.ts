export interface RegionThresholds {
  precipitation_1h_mm: number;
  precipitation_3h_mm: number;
  precipitation_probability: number;
  wind_speed_kmh: number;
  wmo_codes: number[];
}

export interface Region {
  code: string;
  name: string;
  lat: number;
  lon: number;
  thresholds: RegionThresholds;
}

const DEFAULT_THRESHOLDS = {
  precipitation_1h_mm: 20,
  precipitation_3h_mm: 50,
  precipitation_probability: 85,
  wind_speed_kmh: 60,
  wmo_codes: [61, 63, 65, 80, 81, 82, 95, 96, 99],
} satisfies RegionThresholds;

const REGION_COORDINATES = [
  { code: "accra", name: "Greater Accra", lat: 5.6037, lon: -0.187 },
  { code: "kumasi", name: "Ashanti", lat: 6.6885, lon: -1.6244 },
  { code: "takoradi", name: "Western", lat: 4.9167, lon: -1.7667 },
  { code: "capecoast", name: "Central", lat: 5.1167, lon: -1.2833 },
  { code: "koforidua", name: "Eastern", lat: 6.1833, lon: -0.4667 },
  { code: "ho", name: "Volta", lat: 6.5833, lon: 0.4667 },
  { code: "tamale", name: "Northern", lat: 9.4008, lon: -0.8393 },
  { code: "bolgatanga", name: "Upper East", lat: 10.7833, lon: -0.9833 },
  { code: "wa", name: "Upper West", lat: 10.3333, lon: -2.25 },
  { code: "sunyani", name: "Bono", lat: 7.5667, lon: -2.5833 },
  { code: "techiman", name: "Bono East", lat: 7.7833, lon: -1.35 },
  { code: "goaso", name: "Ahafo", lat: 7.0833, lon: -2.4 },
  { code: "damongo", name: "Savannah", lat: 9.0833, lon: -1.8167 },
  { code: "nalerigu", name: "North East", lat: 10.5167, lon: -0.3667 },
  { code: "sefwi", name: "Western North", lat: 6.3, lon: -2.8 },
  { code: "dambai", name: "Oti", lat: 7.9, lon: 0.3 },
] satisfies Omit<Region, "thresholds">[];

export const regions: Region[] = REGION_COORDINATES.map((region) => ({
  ...region,
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    wmo_codes: [...DEFAULT_THRESHOLDS.wmo_codes],
  },
}));

export function getRegionByCode(code: string): Region | undefined {
  return regions.find((region) => region.code === code);
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestRegion(lat: number, lon: number): Region | null {
  let nearest: Region | null = null;
  let minimumDistance = Infinity;

  for (const region of regions) {
    const distance = haversineDistance(lat, lon, region.lat, region.lon);

    if (distance < minimumDistance) {
      minimumDistance = distance;
      nearest = region;
    }
  }

  return nearest;
}
