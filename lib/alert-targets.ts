import type { Region } from "@/lib/regions";
import { findNearestRegion, regions as defaultRegions } from "@/lib/regions";

export type ActiveSubscriberForAlert = {
  phone: string;
  regionCode: string;
  forecastZoneCode: string | null;
  forecastLat: number | null;
  forecastLon: number | null;
};

export type AlertTargetKind = "region" | "forecast-zone";

export type AlertTarget = {
  code: string;
  kind: AlertTargetKind;
  displayName: string;
  regionCode: string;
  forecastPoint: {
    lat: number;
    lon: number;
  };
  evaluationRegion: Region;
  subscribers: {
    phone: string;
  }[];
};

function getRegionByCodeFromList(
  code: string,
  configuredRegions: Region[],
): Region | undefined {
  return configuredRegions.find((region) => region.code === code);
}

function hasCompleteForecastZone(
  subscriber: ActiveSubscriberForAlert,
): subscriber is ActiveSubscriberForAlert & {
  forecastZoneCode: string;
  forecastLat: number;
  forecastLon: number;
} {
  return (
    !!subscriber.forecastZoneCode &&
    typeof subscriber.forecastLat === "number" &&
    typeof subscriber.forecastLon === "number"
  );
}

export function createAlertTargets(
  subscribers: ActiveSubscriberForAlert[],
  configuredRegions = defaultRegions,
): AlertTarget[] {
  const legacySubscribersByRegion = new Map<string, { phone: string }[]>();
  const zoneTargetsByCode = new Map<string, AlertTarget>();

  for (const subscriber of subscribers) {
    const selectedRegion = getRegionByCodeFromList(
      subscriber.regionCode,
      configuredRegions,
    );

    if (hasCompleteForecastZone(subscriber)) {
      const zoneRegion =
        selectedRegion ??
        findNearestRegion(subscriber.forecastLat, subscriber.forecastLon);

      if (!zoneRegion) {
        continue;
      }

      const existingTarget = zoneTargetsByCode.get(subscriber.forecastZoneCode);

      if (existingTarget) {
        existingTarget.subscribers.push({ phone: subscriber.phone });
        continue;
      }

      const displayName = `your area in ${zoneRegion.name}`;
      zoneTargetsByCode.set(subscriber.forecastZoneCode, {
        code: subscriber.forecastZoneCode,
        kind: "forecast-zone",
        displayName,
        regionCode: zoneRegion.code,
        forecastPoint: {
          lat: subscriber.forecastLat,
          lon: subscriber.forecastLon,
        },
        evaluationRegion: {
          ...zoneRegion,
          code: subscriber.forecastZoneCode,
          name: displayName,
          lat: subscriber.forecastLat,
          lon: subscriber.forecastLon,
        },
        subscribers: [{ phone: subscriber.phone }],
      });
      continue;
    }

    if (!selectedRegion) {
      continue;
    }

    const existingSubscribers =
      legacySubscribersByRegion.get(selectedRegion.code) ?? [];
    existingSubscribers.push({ phone: subscriber.phone });
    legacySubscribersByRegion.set(selectedRegion.code, existingSubscribers);
  }

  const regionTargets = configuredRegions.map((region) => ({
    code: region.code,
    kind: "region" as const,
    displayName: region.name,
    regionCode: region.code,
    forecastPoint: {
      lat: region.lat,
      lon: region.lon,
    },
    evaluationRegion: region,
    subscribers: legacySubscribersByRegion.get(region.code) ?? [],
  }));

  return [...regionTargets, ...zoneTargetsByCode.values()];
}
