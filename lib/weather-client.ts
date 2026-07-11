import "server-only";

import type { Region } from "@/lib/regions";

export type ForecastPoint = {
  lat: number;
  lon: number;
};

export type WeatherForecast = {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    precipitation: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
};

function assertWeatherForecast(value: unknown): asserts value is WeatherForecast {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid weather response.");
  }

  const forecast = value as WeatherForecast;

  if (
    !forecast.hourly ||
    !Array.isArray(forecast.hourly.time) ||
    !Array.isArray(forecast.hourly.precipitation) ||
    !Array.isArray(forecast.hourly.precipitation_probability) ||
    !Array.isArray(forecast.hourly.wind_speed_10m) ||
    !Array.isArray(forecast.hourly.weather_code)
  ) {
    throw new Error("Invalid weather response.");
  }
}

export async function fetchRegionForecast(
  region: Region,
): Promise<WeatherForecast> {
  return fetchPointForecast(region);
}

export type FetchPointForecastOptions = {
  revalidate?: number;
};

export async function fetchPointForecast(
  point: ForecastPoint,
  options: FetchPointForecastOptions = {},
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lon),
    hourly:
      "precipitation,precipitation_probability,wind_speed_10m,weather_code",
    forecast_days: "1",
    timezone: "UTC",
  });
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    options.revalidate
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with ${response.status}.`);
  }

  const data: unknown = await response.json();
  assertWeatherForecast(data);
  return data;
}
