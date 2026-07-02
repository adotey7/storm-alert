import type { CatchmentConfig } from "@/lib/catchments";
import {
  catchments as defaultCatchments,
  findCatchmentForPoint,
} from "@/lib/catchments";
import type { Region } from "@/lib/regions";
import { findNearestRegion, regions as defaultRegions } from "@/lib/regions";
import type { ForecastPoint } from "@/lib/weather-client";

export type ActiveSubscriberForAlert = {
  phone: string;
  regionCode: string;
  forecastZoneCode: string | null;
  forecastLat: number | null;
  forecastLon: number | null;
};

export type AlertTargetKind = "region" | "forecast-zone" | "catchment";

export type AlertTargetForecastPoint = {
  name: string;
  role: "local" | "upstream";
  point: ForecastPoint;
};

export type AlertTarget = {
  code: string;
  kind: AlertTargetKind;
  displayName: string;
  catchmentWaterway?: string;
  regionCode: string;
  forecastPoint: ForecastPoint;
  forecastPoints: AlertTargetForecastPoint[];
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
  configuredCatchments: CatchmentConfig[] = defaultCatchments,
): AlertTarget[] {
  const legacySubscribersByRegion = new Map<string, { phone: string }[]>();
  const zoneTargetsByCode = new Map<string, AlertTarget>();
  const catchmentTargetsByCode = new Map<string, AlertTarget>();

  for (const subscriber of subscribers) {
    const selectedRegion = getRegionByCodeFromList(
      subscriber.regionCode,
      configuredRegions,
    );

    if (hasCompleteForecastZone(subscriber)) {
      const subscriberPoint = {
        lat: subscriber.forecastLat,
        lon: subscriber.forecastLon,
      };
      const catchment = findCatchmentForPoint(
        subscriberPoint,
        configuredCatchments,
      );

      if (catchment) {
        const catchmentRegion = getRegionByCodeFromList(
          catchment.regionCode,
          configuredRegions,
        );

        if (!catchmentRegion) {
          continue;
        }

        const existingTarget = catchmentTargetsByCode.get(catchment.code);

        if (existingTarget) {
          existingTarget.subscribers.push({ phone: subscriber.phone });
          continue;
        }

        const forecastPoint = catchment.impactCenter;
        catchmentTargetsByCode.set(catchment.code, {
          code: catchment.code,
          kind: "catchment",
          displayName: catchment.displayName,
          catchmentWaterway: catchment.waterwayName,
          regionCode: catchment.regionCode,
          forecastPoint,
          forecastPoints: [
            {
              name: catchment.displayName,
              role: "local",
              point: forecastPoint,
            },
            ...catchment.upstreamWatchPoints.map((point) => ({
              name: point.name,
              role: "upstream" as const,
              point: {
                lat: point.lat,
                lon: point.lon,
              },
            })),
          ],
          evaluationRegion: {
            ...catchmentRegion,
            code: catchment.code,
            name: catchment.displayName,
            lat: forecastPoint.lat,
            lon: forecastPoint.lon,
          },
          subscribers: [{ phone: subscriber.phone }],
        });
        continue;
      }

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
        forecastPoints: [
          {
            name: displayName,
            role: "local",
            point: {
              lat: subscriber.forecastLat,
              lon: subscriber.forecastLon,
            },
          },
        ],
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
    forecastPoints: [
      {
        name: region.name,
        role: "local" as const,
        point: {
          lat: region.lat,
          lon: region.lon,
        },
      },
    ],
    evaluationRegion: region,
    subscribers: legacySubscribersByRegion.get(region.code) ?? [],
  }));

  return [
    ...regionTargets,
    ...catchmentTargetsByCode.values(),
    ...zoneTargetsByCode.values(),
  ];
}
