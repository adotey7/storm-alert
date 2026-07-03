import { getWmoCodeMeta } from "@/lib/wmo-code-meta";
import type { WeatherForecast } from "@/lib/weather-client";

interface Props {
  forecast: WeatherForecast;
}

function formatHour(iso: string): string {
  const hour = iso.slice(11, 13);
  return hour ? `${hour}:00` : iso;
}

export default function HourlyForecastStrip({ forecast }: Props) {
  const { time, precipitation, precipitation_probability, wind_speed_10m, weather_code } =
    forecast.hourly;
  const maxPrecip = Math.max(...precipitation, 1);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {time.map((iso, index) => {
        const meta = getWmoCodeMeta(weather_code[index]);
        const Icon = meta.icon;
        const precip = precipitation[index];
        const barHeight = Math.round((precip / maxPrecip) * 100);

        return (
          <div
            key={iso}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-canvas px-2 py-3 text-center"
          >
            <span className="text-[11px] font-medium text-ink-muted">
              {formatHour(iso)}
            </span>
            <Icon size={18} className="text-ink-secondary" aria-hidden="true" />
            <span className="text-[11px] leading-tight text-ink-secondary">
              {precip}mm
            </span>
            <div className="flex h-8 w-full items-end overflow-hidden rounded bg-ink/[0.04]">
              <div
                className="w-full bg-earth/60"
                style={{ height: `${barHeight}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-[10px] text-ink-muted">
              {precipitation_probability[index]}%
            </span>
            <span className="text-[10px] text-ink-muted">
              {Math.round(wind_speed_10m[index])}km/h
            </span>
          </div>
        );
      })}
    </div>
  );
}
