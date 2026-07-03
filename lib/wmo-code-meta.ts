import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  type LucideIcon,
} from "lucide-react";

export type WmoCodeMeta = {
  code: number;
  label: string;
  icon: LucideIcon;
};

const WMO_CODE_MAP: Record<number, { label: string; icon: LucideIcon }> = {
  0: { label: "Clear sky", icon: Sun },
  1: { label: "Mainly clear", icon: Sun },
  2: { label: "Partly cloudy", icon: Cloud },
  3: { label: "Overcast", icon: Cloud },
  45: { label: "Fog", icon: CloudFog },
  48: { label: "Rime fog", icon: CloudFog },
  51: { label: "Light drizzle", icon: CloudDrizzle },
  53: { label: "Drizzle", icon: CloudDrizzle },
  55: { label: "Dense drizzle", icon: CloudDrizzle },
  56: { label: "Freezing drizzle", icon: CloudDrizzle },
  57: { label: "Dense freezing drizzle", icon: CloudDrizzle },
  61: { label: "Rain", icon: CloudRain },
  63: { label: "Moderate rain", icon: CloudRain },
  65: { label: "Heavy rain", icon: CloudRain },
  66: { label: "Freezing rain", icon: CloudRain },
  67: { label: "Heavy freezing rain", icon: CloudRain },
  71: { label: "Light snow", icon: CloudSnow },
  73: { label: "Snow", icon: CloudSnow },
  75: { label: "Heavy snow", icon: CloudSnow },
  77: { label: "Snow grains", icon: CloudSnow },
  80: { label: "Rain showers", icon: CloudRain },
  81: { label: "Heavy showers", icon: CloudRain },
  82: { label: "Violent showers", icon: CloudRain },
  85: { label: "Snow showers", icon: CloudSnow },
  86: { label: "Heavy snow showers", icon: CloudSnow },
  95: { label: "Thunderstorm", icon: CloudLightning },
  96: { label: "Thunderstorm + hail", icon: CloudLightning },
  99: { label: "Thunderstorm + heavy hail", icon: CloudLightning },
};

const FALLBACK: { label: string; icon: LucideIcon } = {
  label: "Unknown",
  icon: Cloud,
};

export function getWmoCodeMeta(code: number): WmoCodeMeta {
  const entry = WMO_CODE_MAP[code] ?? FALLBACK;
  return { code, label: entry.label, icon: entry.icon };
}
