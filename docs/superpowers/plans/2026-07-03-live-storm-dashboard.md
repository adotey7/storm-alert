# Live Storm Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface existing weather-risk data (Open-Meteo evaluation + `AlertLog` history) as four UI surfaces: a `/alerts` dashboard with an interactive Leaflet coverage map, a per-region `/region/[code]` detail page, and an impact bar + live risk chip on the homepage.

**Architecture:** A server-only `lib/live-risk.ts` computes current risk for all 16 regions + the Odaw catchment on demand, cached ~5 min via Next's fetch `next.revalidate` (this project uses the Previous caching model — no `cacheComponents`). It reuses the existing `fetchPointForecast` / `evaluateAlertRisk` / `evaluateCatchmentAlertRisk` building blocks without duplicating logic. `AlertLog` (read-only Prisma queries via `lib/alert-stats.ts`) powers the recent-alerts timeline and impact stats. Server Components fetch directly; the Leaflet map is a client component loaded via `next/dynamic({ ssr: false })` through a thin client loader.

**Tech Stack:** Next.js 16 (App Router, Previous caching model), React 19, Tailwind 4, Prisma 7, Vitest, `leaflet` + `react-leaflet@5.0.0` (new), `lucide-react`.

## Global Constraints

- **Next.js 16 rules (`AGENTS.md`):** This Next.js has breaking changes; the bundled docs in `node_modules/next/dist/docs/` are authoritative. Caching uses the **Previous Model** (`next.config.ts` has only `reactCompiler: true`, no `cacheComponents`): use `fetch(url, { next: { revalidate } })`, NOT the `'use cache'` directive.
- **`next/dynamic` `ssr:false`** is only valid inside Client Components — never in Server Components. The Leaflet map must go through a `'use client'` loader wrapper.
- **Server-only modules** begin with `import "server-only";` (see `lib/weather-client.ts`, `lib/prisma.ts`).
- **Never duplicate domain logic.** Reuse `fetchPointForecast`, `evaluateAlertRisk`, `evaluateCatchmentAlertRisk`, `regions`, `catchments`, `getRegionByCode`. New code is additive data-assembly + UI only.
- **Cron is untouched.** The poll-weather cron keeps `cache: "no-store"`. The cached UI path is opt-in via the new optional `revalidate` argument on `fetchPointForecast`.
- **RSC boundaries:** pass only plain-serializable props to Client Components; serialize `Date` → ISO string on the server (DB rows' `triggeredAt` etc.).
- **Tailwind theme tokens** defined in `app/globals.css` (`@theme inline`): `canvas`, `ink`, `ink-secondary`, `ink-muted`, `border`, `earth`, `earth-hover`, `success`, `error`. Use these — do not hardcode hex.
- **Test style:** Vitest, `import { describe, expect, it } from "vitest"`, co-located `lib/*.test.ts`. Pure logic is unit-tested; fetch/DB wrappers are not (matches existing `weather-client.ts` / cron having no network unit tests).
- **Page shell pattern:** `<main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">` with centered `max-w-2xl` column and the `CloudLightning` footer line (see `app/page.tsx`, `app/verify/page.tsx`).
- **Icons:** `lucide-react`. Use icons present in the codebase (`CloudLightning`, `MapPin`, `Navigation`, `AlertCircle`, `Loader2`, `ArrowRight`, `CheckCircle2`) plus standard lucide names (`CloudRain`, `CloudDrizzle`, `Cloud`, `CloudFog`, `Sun`, `CloudSnow`, `Wind`). If a name is missing in this version, `pnpm typecheck` fails loudly — that is an intentional safe failure.
- **Package manager:** `pnpm` (see `package.json` `packageManager: pnpm@10.21.0`).
- **Commit on the `feat/live-storm-dashboard` branch.** One commit per task (or per step where noted).

---

## File Structure

**New `lib/` modules (domain logic, server-only where they touch fetch/DB):**
- `lib/risk-level.ts` — pure `RiskLevel` type, `deriveRiskLevel(region, evaluation)`, `RISK_LEVEL_LABELS`.
- `lib/risk-level.test.ts` — unit tests for `deriveRiskLevel`.
- `lib/wmo-code-meta.ts` — WMO weather code → `{ label, icon }`; pure lookup.
- `lib/wmo-code-meta.test.ts` — unit tests.
- `lib/live-risk.ts` — `import "server-only"`; cached region + catchment risk summaries. Exports `getLiveRiskSummary`, `getRegionDetail`, and pure helpers `summarizeRegion`, `summarizeCatchment` (tested).
- `lib/live-risk.test.ts` — unit tests for the pure summarize helpers (evaluations passed in, fetch mocked).
- `lib/alert-stats.ts` — `import "server-only"`; `getAlertStats`, `getRecentAlerts` (Prisma reads of `AlertLog` / `Subscriber`).

**New `app/_components/`:**
- `risk-level-styles.ts` — `RISK_LEVEL_STYLES` (Tailwind class strings per level).
- `hourly-forecast-strip.tsx` — presentational hourly strip (server).
- `region-risk-card.tsx` — presentational card (server).
- `recent-alerts.tsx` — AlertLog feed (server).
- `impact-bar.tsx` — stats row (server).
- `coverage-map.tsx` — `'use client'`; react-leaflet map.
- `coverage-map-loader.tsx` — `'use client'`; `dynamic(() => import('./coverage-map'), { ssr: false })`.
- `region-risk-chip.tsx` — `'use client'`; homepage selected-region chip.

**New routes:**
- `app/alerts/page.tsx` — dashboard (server component).
- `app/region/[code]/page.tsx` — region detail (server component).

**Modified:**
- `lib/weather-client.ts` — add optional `{ revalidate?: number }` to `fetchPointForecast`.
- `app/page.tsx` — render `ImpactBar` + pass region summaries to `SubscribeForm`.
- `app/_components/subscribe-form.tsx` — accept optional `regionSummaries` prop and render `RegionRiskChip`.

**New dependency:** `leaflet`, `react-leaflet`, `@types/leaflet` (dev).

---

## Task 1: `lib/risk-level.ts` — pure risk-level derivation

**Files:**
- Create: `lib/risk-level.ts`
- Test: `lib/risk-level.test.ts`

**Interfaces:**
- Consumes: `AlertEvaluation` from `@/lib/alert-evaluator`; `Region` from `@/lib/regions`.
- Produces: `RiskLevel` type, `deriveRiskLevel(region, evaluation): RiskLevel`, `RISK_LEVEL_LABELS: Record<RiskLevel, string>`.

`deriveRiskLevel` returns `warning` | `watch` | `clear`. It never returns `unknown` — callers set `unknown` when a forecast fetch fails (no evaluation available). Thresholds are read off `region.thresholds`.

- [ ] **Step 1: Write the failing test**

Create `lib/risk-level.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveRiskLevel, RISK_LEVEL_LABELS, type RiskLevel } from "./risk-level";
import type { AlertEvaluation } from "./alert-evaluator";
import type { Region } from "./regions";

const region: Region = {
  code: "test",
  name: "Test",
  lat: 5,
  lon: 0,
  thresholds: {
    precipitation_1h_mm: 20,
    precipitation_3h_mm: 50,
    precipitation_probability: 85,
    wind_speed_kmh: 60,
    wmo_codes: [61, 63, 65, 80, 81, 82, 95, 96, 99],
  },
};

const clear: AlertEvaluation = {
  triggered: false,
  reasons: [],
  metrics: {
    maxPrecipitation1hMm: 0,
    maxPrecipitation3hMm: 0,
    maxPrecipitationProbability: 10,
    maxWindSpeedKmh: 12,
    matchedWeatherCodes: [],
  },
};

describe("deriveRiskLevel", () => {
  it("returns warning when the evaluation is triggered", () => {
    expect(
      deriveRiskLevel(region, { ...clear, triggered: true, reasons: ["wind"] }),
    ).toBe("warning");
  });

  it("returns watch when precipitation probability is elevated (>=60) but not triggered", () => {
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, maxPrecipitationProbability: 65 },
      }),
    ).toBe("watch");
  });

  it("returns watch when any metric reaches half its threshold", () => {
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, maxPrecipitation1hMm: 11 },
      }),
    ).toBe("watch");
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, maxWindSpeedKmh: 35 },
      }),
    ).toBe("watch");
  });

  it("returns watch when a concerning weather code is present", () => {
    expect(
      deriveRiskLevel(region, {
        ...clear,
        metrics: { ...clear.metrics, matchedWeatherCodes: [61] },
      }),
    ).toBe("watch");
  });

  it("returns clear when nothing is elevated", () => {
    expect(deriveRiskLevel(region, clear)).toBe("clear");
  });

  it("labels every level", () => {
    const levels: RiskLevel[] = ["warning", "watch", "clear", "unknown"];
    for (const level of levels) {
      expect(RISK_LEVEL_LABELS[level]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- risk-level`
Expected: FAIL — module `./risk-level` not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/risk-level.ts`:

```ts
import type { AlertEvaluation } from "@/lib/alert-evaluator";
import type { Region } from "@/lib/regions";

export type RiskLevel = "warning" | "watch" | "clear" | "unknown";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  warning: "Warning",
  watch: "Watch",
  clear: "Clear",
  unknown: "Unknown",
};

const WATCH_PROBABILITY = 60;
const HALF_THRESHOLD = 0.5;

/**
 * Maps an alert evaluation to a coarse risk level for UI display.
 *
 * Returns `warning` when the evaluator triggered, `watch` when metrics are
 * elevated but below trigger thresholds, or `clear` otherwise. It never
 * returns `unknown` — callers set that when a forecast fetch failed and no
 * evaluation is available.
 */
export function deriveRiskLevel(
  region: Region,
  evaluation: AlertEvaluation,
): Exclude<RiskLevel, "unknown"> {
  if (evaluation.triggered) {
    return "warning";
  }

  const { thresholds } = region;
  const { metrics } = evaluation;

  const elevatedProbability = metrics.maxPrecipitationProbability >= WATCH_PROBABILITY;
  const halfOf1h =
    metrics.maxPrecipitation1hMm >= thresholds.precipitation_1h_mm * HALF_THRESHOLD;
  const halfOf3h =
    metrics.maxPrecipitation3hMm >= thresholds.precipitation_3h_mm * HALF_THRESHOLD;
  const halfOfWind =
    metrics.maxWindSpeedKmh >= thresholds.wind_speed_kmh * HALF_THRESHOLD;
  const concerningWeatherCode = metrics.matchedWeatherCodes.length > 0;

  if (
    elevatedProbability ||
    halfOf1h ||
    halfOf3h ||
    halfOfWind ||
    concerningWeatherCode
  ) {
    return "watch";
  }

  return "clear";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run -- risk-level`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/risk-level.ts lib/risk-level.test.ts
git commit -m "Add risk-level derivation helper"
```

---

## Task 2: `lib/wmo-code-meta.ts` — WMO weather-code metadata

**Files:**
- Create: `lib/wmo-code-meta.ts`
- Test: `lib/wmo-code-meta.test.ts`

**Interfaces:**
- Consumes: `lucide-react` icons.
- Produces: `WmoCodeMeta` (`{ code, label, icon }`), `getWmoCodeMeta(code): WmoCodeMeta`.

Covers the WMO codes that appear in `regions.ts` defaults (0–3, 45/48, 51–57, 61–67, 71–77, 80–82, 85–86, 95–99) and falls back to a generic `Cloud` icon + `"Unknown"` label for unmapped codes.

- [ ] **Step 1: Write the failing test**

Create `lib/wmo-code-meta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getWmoCodeMeta } from "./wmo-code-meta";

describe("getWmoCodeMeta", () => {
  it("maps clear-sky code 0 to a Sunny label", () => {
    const meta = getWmoCodeMeta(0);
    expect(meta.code).toBe(0);
    expect(meta.label).toBe("Clear sky");
  });

  it("maps thunderstorm codes 95-99 to a thunderstorm label", () => {
    expect(getWmoCodeMeta(95).label).toBe("Thunderstorm");
    expect(getWmoCodeMeta(99).label).toBe("Thunderstorm");
  });

  it("maps rain codes 61-65 to a Rain label", () => {
    expect(getWmoCodeMeta(61).label).toBe("Rain");
    expect(getWmoCodeMeta(65).label).toBe("Heavy rain");
  });

  it("falls back to an Unknown label and Cloud icon for unmapped codes", () => {
    const meta = getWmoCodeMeta(1234);
    expect(meta.label).toBe("Unknown");
    expect(meta.code).toBe(1234);
  });

  it("always returns an icon component", () => {
    expect(typeof getWmoCodeMeta(2).icon).toBe("object");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- wmo-code-meta`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/wmo-code-meta.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run -- wmo-code-meta`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck (verifies icon names exist in this lucide version)**

Run: `pnpm typecheck`
Expected: PASS. If a lucide icon name is missing, this fails — fix by substituting an icon known to exist (`Cloud`).

- [ ] **Step 6: Commit**

```bash
git add lib/wmo-code-meta.ts lib/wmo-code-meta.test.ts
git commit -m "Add WMO weather-code metadata mapping"
```

---

## Task 3: Extend `fetchPointForecast` with a cached revalidate option

**Files:**
- Modify: `lib/weather-client.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `fetchPointForecast(point, options?: { revalidate?: number })` — default (no options) keeps `cache: "no-store"` (cron unchanged); `{ revalidate: 300 }` opts into Next's fetch revalidation for the UI path.

No unit test (matches the codebase: `weather-client.ts` has no network unit test). Verify via `pnpm typecheck` + the existing suite still passing.

- [ ] **Step 1: Read the current file** to confirm exact contents (`lib/weather-client.ts:47-70`).

- [ ] **Step 2: Apply the edit**

In `lib/weather-client.ts`, replace the `fetchPointForecast` function:

```ts
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
```

Leave `fetchRegionForecast` unchanged (it delegates to `fetchPointForecast(region)` with no options → `no-store`, preserving cron behavior).

- [ ] **Step 3: Typecheck + run existing tests**

Run: `pnpm typecheck && pnpm test:run`
Expected: PASS. Existing tests (alert-evaluator etc.) unaffected; cron callers compile unchanged.

- [ ] **Step 4: Commit**

```bash
git add lib/weather-client.ts
git commit -m "Add optional revalidate cache to fetchPointForecast"
```

---

## Task 4: `lib/live-risk.ts` — cached live-risk summaries

**Files:**
- Create: `lib/live-risk.ts`
- Test: `lib/live-risk.test.ts`

**Interfaces:**
- Consumes: `fetchPointForecast` (with `{ revalidate: 300 }`), `evaluateAlertRisk`, `evaluateCatchmentAlertRisk`, `regions`, `getRegionByCode`, `catchments`, `deriveRiskLevel`.
- Produces:
  - `RegionRiskSummary` (`{ code, name, lat, lon, level, reasons, metrics, evaluatedAt }`)
  - `CatchmentRiskSummary` (`{ code, displayName, waterwayName, lat, lon, radiusKm, regionCode, level, reasons, upstream: Array<{ name, lat, lon, level }>, evaluatedAt }`)
  - `LiveRiskSummary` (`{ regions, catchments, evaluatedAt }`)
  - `RegionDetail` (`{ summary, forecast }`)
  - `getLiveRiskSummary(): Promise<LiveRiskSummary>`
  - `getRegionDetail(code: string): Promise<RegionDetail | null>`
  - Pure helpers `summarizeRegion(region, forecast, evaluatedAt)` and `summarizeCatchment(catchment, sources, upstreamSummaries, evaluatedAt)` — these are unit-tested.

The fetch orchestration uses `Promise.allSettled` (mirrors the cron's `fetchTargetForecasts` fault tolerance) so a single region's Open-Meteo failure degrades that region to `unknown`, not a 500. `LIVE_RISK_REVALIDATE_SECONDS = 300`.

- [ ] **Step 1: Write the failing test for the pure summarize helpers**

Create `lib/live-risk.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  summarizeRegion,
  summarizeCatchment,
} from "./live-risk";
import type { Region } from "./regions";
import type { WeatherForecast } from "./weather-client";
import { catchments } from "./catchments";

const region: Region = {
  code: "accra",
  name: "Greater Accra",
  lat: 5.6037,
  lon: -0.187,
  thresholds: {
    precipitation_1h_mm: 20,
    precipitation_3h_mm: 50,
    precipitation_probability: 85,
    wind_speed_kmh: 60,
    wmo_codes: [61, 63, 65, 80, 81, 82, 95, 96, 99],
  },
};

const evaluatedAt = "2026-07-03T12:00:00.000Z";

function forecast(
  overrides: Partial<WeatherForecast["hourly"]> = {},
): WeatherForecast {
  return {
    latitude: region.lat,
    longitude: region.lon,
    hourly: {
      time: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"],
      precipitation: [0, 0, 0, 0, 0, 0],
      precipitation_probability: [10, 10, 10, 10, 10, 10],
      wind_speed_10m: [10, 10, 10, 10, 10, 10],
      weather_code: [0, 0, 0, 0, 0, 0],
      ...overrides,
    },
  };
}

describe("summarizeRegion", () => {
  it("derives a clear level and copies coordinates", () => {
    const summary = summarizeRegion(region, forecast(), evaluatedAt);
    expect(summary.code).toBe("accra");
    expect(summary.lat).toBe(5.6037);
    expect(summary.lon).toBe(-0.187);
    expect(summary.level).toBe("clear");
    expect(summary.reasons).toEqual([]);
    expect(summary.evaluatedAt).toBe(evaluatedAt);
  });

  it("derives a warning level when triggered", () => {
    const summary = summarizeRegion(
      region,
      forecast({ precipitation: [25, 0, 0, 0, 0, 0] }),
      evaluatedAt,
    );
    expect(summary.level).toBe("warning");
    expect(summary.reasons.length).toBeGreaterThan(0);
    expect(summary.metrics.maxPrecipitation1hMm).toBe(25);
  });
});

describe("summarizeCatchment", () => {
  const catchment = catchments[0];

  it("returns unknown when no forecast sources are available", () => {
    const summary = summarizeCatchment(catchment, [], [], evaluatedAt);
    expect(summary.level).toBe("unknown");
    expect(summary.reasons).toContain("forecast unavailable");
    expect(summary.upstream).toHaveLength(catchment.upstreamWatchPoints.length);
    expect(summary.upstream.every((u) => u.level === "unknown")).toBe(true);
  });

  it("derives a warning level from upstream heavy rain", () => {
    const sources = [
      {
        name: catchment.displayName,
        role: "local" as const,
        forecast: forecast(),
      },
      {
        name: "Aburi Ridge",
        role: "upstream" as const,
        forecast: forecast({ precipitation: [25, 0, 0, 0, 0, 0] }),
      },
    ];
    const upstream = [
      { name: "Aburi Ridge", lat: 5.848, lon: -0.1745, level: "warning" as const },
    ];
    const summary = summarizeCatchment(catchment, sources, upstream, evaluatedAt);
    expect(summary.level).toBe("warning");
    expect(summary.reasons.some((r) => r.startsWith("upstream"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- live-risk`
Expected: FAIL — module `./live-risk` not found.

- [ ] **Step 3: Write the implementation**

Create `lib/live-risk.ts`:

```ts
import "server-only";

import {
  evaluateAlertRisk,
  evaluateCatchmentAlertRisk,
  type AlertEvaluation,
} from "@/lib/alert-evaluator";
import { type CatchmentConfig, catchments } from "@/lib/catchments";
import { deriveRiskLevel, type RiskLevel } from "@/lib/risk-level";
import { getRegionByCode, regions, type Region } from "@/lib/regions";
import {
  fetchPointForecast,
  type WeatherForecast,
} from "@/lib/weather-client";

export const LIVE_RISK_REVALIDATE_SECONDS = 300;

export type RegionRiskSummary = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  level: RiskLevel;
  reasons: string[];
  metrics: AlertEvaluation["metrics"];
  evaluatedAt: string;
};

export type CatchmentUpstreamSummary = {
  name: string;
  lat: number;
  lon: number;
  level: RiskLevel;
};

export type CatchmentRiskSummary = {
  code: string;
  displayName: string;
  waterwayName: string;
  lat: number;
  lon: number;
  radiusKm: number;
  regionCode: string;
  level: RiskLevel;
  reasons: string[];
  upstream: CatchmentUpstreamSummary[];
  evaluatedAt: string;
};

export type LiveRiskSummary = {
  regions: RegionRiskSummary[];
  catchments: CatchmentRiskSummary[];
  evaluatedAt: string;
};

export type RegionDetail = {
  summary: RegionRiskSummary;
  forecast: WeatherForecast;
};

type CatchmentForecastSource = {
  name: string;
  role: "local" | "upstream";
  forecast: WeatherForecast;
};

/** Pure: shape a region's forecast into a UI summary. */
export function summarizeRegion(
  region: Region,
  forecast: WeatherForecast,
  evaluatedAt: string,
): RegionRiskSummary {
  const evaluation = evaluateAlertRisk(region, forecast);
  return {
    code: region.code,
    name: region.name,
    lat: region.lat,
    lon: region.lon,
    level: deriveRiskLevel(region, evaluation),
    reasons: evaluation.reasons,
    metrics: evaluation.metrics,
    evaluatedAt,
  };
}

/** Pure: shape catchment forecast sources into a UI summary. */
export function summarizeCatchment(
  catchment: CatchmentConfig,
  sources: CatchmentForecastSource[],
  upstream: CatchmentUpstreamSummary[],
  evaluatedAt: string,
): CatchmentRiskSummary {
  const region = getRegionByCode(catchment.regionCode);

  if (sources.length === 0 || !region) {
    return {
      code: catchment.code,
      displayName: catchment.displayName,
      waterwayName: catchment.waterwayName,
      lat: catchment.impactCenter.lat,
      lon: catchment.impactCenter.lon,
      radiusKm: catchment.impactRadiusKm,
      regionCode: catchment.regionCode,
      level: "unknown",
      reasons: ["forecast unavailable"],
      upstream: catchment.upstreamWatchPoints.map((point) => ({
        name: point.name,
        lat: point.lat,
        lon: point.lon,
        level: "unknown" as const,
      })),
      evaluatedAt,
    };
  }

  const evaluationRegion: Region = {
    ...region,
    code: catchment.code,
    name: catchment.displayName,
    lat: catchment.impactCenter.lat,
    lon: catchment.impactCenter.lon,
  };
  const evaluation = evaluateCatchmentAlertRisk(evaluationRegion, sources);

  return {
    code: catchment.code,
    displayName: catchment.displayName,
    waterwayName: catchment.waterwayName,
    lat: catchment.impactCenter.lat,
    lon: catchment.impactCenter.lon,
    radiusKm: catchment.impactRadiusKm,
    regionCode: catchment.regionCode,
    level: deriveRiskLevel(evaluationRegion, evaluation),
    reasons: evaluation.reasons,
    upstream,
    evaluatedAt,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function evaluateCatchmentSummary(
  catchment: CatchmentConfig,
  evaluatedAt: string,
): Promise<CatchmentRiskSummary> {
  const points = [
    {
      name: catchment.displayName,
      role: "local" as const,
      point: catchment.impactCenter,
    },
    ...catchment.upstreamWatchPoints.map((watch) => ({
      name: watch.name,
      role: "upstream" as const,
      point: { lat: watch.lat, lon: watch.lon },
      watchName: watch.name,
      watchLat: watch.lat,
      watchLon: watch.lon,
    })),
  ];

  const results = await Promise.allSettled(
    points.map(async (p) => ({
      ...p,
      forecast: await fetchPointForecast(p.point, {
        revalidate: LIVE_RISK_REVALIDATE_SECONDS,
      }),
    })),
  );

  const sources: CatchmentForecastSource[] = [];
  const upstream: CatchmentUpstreamSummary[] = [];

  results.forEach((result, index) => {
    const point = points[index];
    if (result.status === "fulfilled") {
      sources.push({
        name: point.name,
        role: point.role,
        forecast: result.value.forecast,
      });
      if (point.role === "upstream" && "watchName" in point) {
        const region = getRegionByCode(catchment.regionCode);
        const level: RiskLevel =
          region ??
          false
            ? deriveRiskLevel(
                { ...(region as Region), code: catchment.code },
                evaluateAlertRisk(region as Region, result.value.forecast),
              )
            : "unknown";
        upstream.push({
          name: point.watchName,
          lat: point.watchLat,
          lon: point.watchLon,
          level,
        });
      }
    } else if (point.role === "upstream" && "watchName" in point) {
      upstream.push({
        name: point.watchName,
        lat: point.watchLat,
        lon: point.watchLon,
        level: "unknown" as const,
      });
    }
  });

  return summarizeCatchment(catchment, sources, upstream, evaluatedAt);
}

export async function getLiveRiskSummary(): Promise<LiveRiskSummary> {
  const evaluatedAt = nowIso();

  const regionResults = await Promise.allSettled(
    regions.map(async (region) => ({
      region,
      forecast: await fetchPointForecast(
        { lat: region.lat, lon: region.lon },
        { revalidate: LIVE_RISK_REVALIDATE_SECONDS },
      ),
    })),
  );

  const regionSummaries: RegionRiskSummary[] = regionResults.map((result) => {
    if (result.status === "fulfilled") {
      return summarizeRegion(result.value.region, result.value.forecast, evaluatedAt);
    }
    const region = regions[regionResults.indexOf(result)];
    return {
      code: region.code,
      name: region.name,
      lat: region.lat,
      lon: region.lon,
      level: "unknown" as const,
      reasons: ["forecast unavailable"],
      metrics: {
        maxPrecipitation1hMm: 0,
        maxPrecipitation3hMm: 0,
        maxPrecipitationProbability: 0,
        maxWindSpeedKmh: 0,
        matchedWeatherCodes: [],
      },
      evaluatedAt,
    };
  });

  const catchmentSummaries = await Promise.all(
    catchments.map((catchment) => evaluateCatchmentSummary(catchment, evaluatedAt)),
  );

  return { regions: regionSummaries, catchments: catchmentSummaries, evaluatedAt };
}

export async function getRegionDetail(
  code: string,
): Promise<RegionDetail | null> {
  const region = getRegionByCode(code);
  if (!region) {
    return null;
  }

  const forecast = await fetchPointForecast(
    { lat: region.lat, lon: region.lon },
    { revalidate: LIVE_RISK_REVALIDATE_SECONDS },
  );

  return {
    summary: summarizeRegion(region, forecast, nowIso()),
    forecast,
  };
}
```

> **Note on the `regionResults.indexOf(result)` lookups + `as Region` casts:** the `Promise.allSettled` result list preserves input order, so the index maps back to the `regions` entry. The upstream-level branch casts `region as Region` because `getRegionByCode` returns `Region | undefined`; the surrounding `region ?` guard has already confirmed it. If this reads awkwardly during implementation, simplify by building a parallel `{ region, result }` array instead — equal outcome, clearer. Keep tests passing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run -- live-risk`
Expected: PASS (4 tests). Fix the implementation until it does — the `evaluateCatchmentSummary` function is not unit-tested (network), but `summarizeRegion` / `summarizeCatchment` are.

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm test:run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/live-risk.ts lib/live-risk.test.ts
git commit -m "Add cached live-risk summary module"
```

---

## Task 5: `lib/alert-stats.ts` — read-only AlertLog + subscriber stats

**Files:**
- Create: `lib/alert-stats.ts`

**Interfaces:**
- Consumes: `getPrisma` from `@/lib/prisma`.
- Produces: `AlertStats` (`{ activeSubscribers, alertsSent, lastAlertAt }`), `RecentAlert` (`{ id, regionCode, triggerReason, triggeredAt, recipientsCount }`), `getAlertStats(): Promise<AlertStats>`, `getRecentAlerts(limit: number): Promise<RecentAlert[]>`.

`Date` fields are serialized to ISO strings on the server. No unit test (DB-layer; matches the codebase having no Prisma unit tests).

- [ ] **Step 1: Write the implementation**

Create `lib/alert-stats.ts`:

```ts
import "server-only";

import { getPrisma } from "@/lib/prisma";

export type AlertStats = {
  activeSubscribers: number;
  alertsSent: number;
  lastAlertAt: string | null;
};

export type RecentAlert = {
  id: string;
  regionCode: string;
  triggerReason: string;
  triggeredAt: string;
  recipientsCount: number;
};

export async function getAlertStats(): Promise<AlertStats> {
  const prisma = getPrisma();

  const [activeSubscribers, alertsSent, lastAlert] = await Promise.all([
    prisma.subscriber.count({ where: { active: true } }),
    prisma.alertLog.count(),
    prisma.alertLog.findFirst({ orderBy: { triggeredAt: "desc" } }),
  ]);

  return {
    activeSubscribers,
    alertsSent,
    lastAlertAt: lastAlert ? lastAlert.triggeredAt.toISOString() : null,
  };
}

export async function getRecentAlerts(limit: number): Promise<RecentAlert[]> {
  const prisma = getPrisma();
  const rows = await prisma.alertLog.findMany({
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    regionCode: row.regionCode,
    triggerReason: row.triggerReason,
    triggeredAt: row.triggeredAt.toISOString(),
    recipientsCount: row.recipientsCount,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (Requires `pnpm prisma:generate` to have run so the generated client types exist.)

- [ ] **Step 3: Commit**

```bash
git add lib/alert-stats.ts
git commit -m "Add alert stats and recent-alerts queries"
```

---

## Task 6: Shared `risk-level-styles.ts` + `RegionRiskChip`

**Files:**
- Create: `app/_components/risk-level-styles.ts`
- Create: `app/_components/region-risk-chip.tsx`

**Interfaces:**
- Consumes: `RiskLevel` + `RISK_LEVEL_LABELS` from `@/lib/risk-level`, `RegionRiskSummary` from `@/lib/live-risk`.
- Produces: `RISK_LEVEL_STYLES` (class strings per level); `RegionRiskChip` (`'use client'`) — takes `regionCode` + `summaries: RegionRiskSummary[]`, looks up the matching summary, renders a small chip (or nothing if not found / unknown).

- [ ] **Step 1: Create `app/_components/risk-level-styles.ts`**

```ts
import type { RiskLevel } from "@/lib/risk-level";

export type RiskLevelStyle = {
  badge: string;
  dot: string;
  text: string;
};

export const RISK_LEVEL_STYLES: Record<RiskLevel, RiskLevelStyle> = {
  warning: {
    badge: "bg-error/10 text-error border-error/20",
    dot: "bg-error",
    text: "text-error",
  },
  watch: {
    badge: "bg-earth/10 text-earth border-earth/20",
    dot: "bg-earth",
    text: "text-earth",
  },
  clear: {
    badge: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
    text: "text-success",
  },
  unknown: {
    badge: "bg-ink/[0.04] text-ink-muted border-border",
    dot: "bg-ink-muted",
    text: "text-ink-muted",
  },
};
```

- [ ] **Step 2: Create `app/_components/region-risk-chip.tsx`**

```tsx
"use client";

import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/risk-level";
import type { RegionRiskSummary } from "@/lib/live-risk";
import { RISK_LEVEL_STYLES } from "./risk-level-styles";

interface Props {
  regionCode: string;
  summaries: RegionRiskSummary[];
}

export default function RegionRiskChip({ regionCode, summaries }: Props) {
  const summary = summaries.find((item) => item.code === regionCode);

  if (!summary) {
    return null;
  }

  const style = RISK_LEVEL_STYLES[summary.level];
  const label = RISK_LEVEL_LABELS[summary.level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${style.badge}`}
      aria-label={`Current risk for ${summary.name}: ${label}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {summary.level === "unknown"
        ? "Risk unavailable"
        : `${label} risk now`}
    </span>
  );
}

// Re-export the type so server callers can keep imports local.
export type { RiskLevel };
```

- [ ] **Step 3: Typecheck (verifies class strings + types)**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/_components/risk-level-styles.ts app/_components/region-risk-chip.tsx
git commit -m "Add risk-level styles and homepage risk chip"
```

---

## Task 7: Region detail page + `HourlyForecastStrip`

**Files:**
- Create: `app/_components/hourly-forecast-strip.tsx`
- Create: `app/region/[code]/page.tsx`

**Interfaces:**
- Consumes: `getRegionDetail` from `@/lib/live-risk`, `getWmoCodeMeta` from `@/lib/wmo-code-meta`, `RISK_LEVEL_STYLES`/`RISK_LEVEL_LABELS`, `regions` for unknown-code handling.
- Produces: `HourlyForecastStrip` (presentational server component) and the `/region/[code]` route.

- [ ] **Step 1: Create `app/_components/hourly-forecast-strip.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `app/region/[code]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CloudLightning } from "lucide-react";
import { getRegionDetail } from "@/lib/live-risk";
import { RISK_LEVEL_LABELS } from "@/lib/risk-level";
import { regions } from "@/lib/regions";
import HourlyForecastStrip from "@/app/_components/hourly-forecast-strip";
import { RISK_LEVEL_STYLES } from "@/app/_components/risk-level-styles";

type Props = {
  params: Promise<{ code: string }>;
};

export function generateStaticParams() {
  return regions.map((region) => ({ code: region.code }));
}

export default async function RegionDetailPage({ params }: Props) {
  const { code } = await params;
  const detail = await getRegionDetail(code);

  if (!detail) {
    notFound();
  }

  const { summary, forecast } = detail;
  const style = RISK_LEVEL_STYLES[summary.level];
  const label = RISK_LEVEL_LABELS[summary.level];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-8 w-full text-center">
          <Link
            href="/alerts"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-earth underline-offset-4 transition-colors hover:underline"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            All regions
          </Link>
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {summary.name}
          </h1>
          <span
            className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${style.badge}`}
          >
            <span className={`size-2 rounded-full ${style.dot}`} aria-hidden="true" />
            {label}
          </span>
        </div>

        <section className="w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Next hours
          </h2>
          <HourlyForecastStrip forecast={forecast} />
        </section>

        {summary.reasons.length > 0 && (
          <section className="mt-8 w-full">
            <h2 className="mb-2 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Risk factors
            </h2>
            <ul className="space-y-1.5">
              {summary.reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-ink-secondary"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/_components/hourly-forecast-strip.tsx app/region/[code]/page.tsx
git commit -m "Add region detail page with hourly forecast strip"
```

---

## Task 8: Dashboard presentational pieces — card, recent alerts, impact bar

**Files:**
- Create: `app/_components/region-risk-card.tsx`
- Create: `app/_components/recent-alerts.tsx`
- Create: `app/_components/impact-bar.tsx`

**Interfaces:**
- Consumes: `RegionRiskSummary`, `CatchmentRiskSummary` from `@/lib/live-risk`; `AlertStats`, `RecentAlert` from `@/lib/alert-stats`; `RISK_LEVEL_STYLES`, `RISK_LEVEL_LABELS`.
- Produces: `RegionRiskCard`, `RecentAlerts`, `ImpactBar` (all presentational server components).

- [ ] **Step 1: Create `app/_components/region-risk-card.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/risk-level";
import type { RegionRiskSummary } from "@/lib/live-risk";
import { RISK_LEVEL_STYLES } from "./risk-level-styles";

interface Props {
  summary: RegionRiskSummary;
}

export default function RegionRiskCard({ summary }: Props) {
  const style = RISK_LEVEL_STYLES[summary.level];
  const label = RISK_LEVEL_LABELS[summary.level];

  return (
    <Link
      href={`/region/${summary.code}`}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-canvas px-4 py-3 transition-colors hover:border-ink-muted focus-visible:rounded-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-medium text-ink">
          {summary.name}
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className={`text-[13px] font-medium ${style.text}`}>{label}</span>
      </div>
    </Link>
  );
}

export type { RiskLevel };
```

- [ ] **Step 2: Create `app/_components/recent-alerts.tsx`**

```tsx
import { Radio } from "lucide-react";
import type { RecentAlert } from "@/lib/alert-stats";

interface Props {
  alerts: RecentAlert[];
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function RecentAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <p className="text-[14px] text-ink-muted">
        No alerts triggered yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-canvas px-3 py-2.5"
        >
          <Radio
            size={15}
            className="mt-0.5 shrink-0 text-earth"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] text-ink-secondary">
              {alert.triggerReason}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {alert.regionCode} · {alert.recipientsCount} notified ·{" "}
              {formatRelative(alert.triggeredAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create `app/_components/impact-bar.tsx`**

```tsx
import { Users, Bell, MapPinned, Clock } from "lucide-react";
import type { AlertStats } from "@/lib/alert-stats";

interface Props {
  stats: AlertStats;
  regionsCovered: number;
  evaluatedAt: string;
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-ink-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="text-lg font-bold text-ink">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export default function ImpactBar({ stats, regionsCovered, evaluatedAt }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-canvas px-5 py-4 sm:grid-cols-4">
      <Stat
        icon={<Users size={16} />}
        value={stats.activeSubscribers.toLocaleString()}
        label="Subscribers"
      />
      <Stat
        icon={<Bell size={16} />}
        value={stats.alertsSent.toLocaleString()}
        label="Alerts sent"
      />
      <Stat
        icon={<MapPinned size={16} />}
        value={String(regionsCovered)}
        label="Regions"
      />
      <Stat
        icon={<Clock size={16} />}
        value={formatRelative(evaluatedAt)}
        label="Checked"
      />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — note `Radio`, `Users`, `Bell`, `Clock`, `MapPinned` are the lucide icons in use; if any name is missing in this version, typecheck fails (substitute a known icon).

- [ ] **Step 5: Commit**

```bash
git add app/_components/region-risk-card.tsx app/_components/recent-alerts.tsx app/_components/impact-bar.tsx
git commit -m "Add dashboard region card, recent alerts, and impact bar"
```

---

## Task 9: Live Storm Dashboard route — `/alerts`

**Files:**
- Create: `app/alerts/page.tsx`

**Interfaces:**
- Consumes: `getLiveRiskSummary` from `@/lib/live-risk`; `getAlertStats`, `getRecentAlerts` from `@/lib/alert-stats`; `RegionRiskCard`, `RecentAlerts`, `ImpactBar`, `RISK_LEVEL_STYLES`, `RISK_LEVEL_LABELS`. The map is wired in Task 10; for now render a placeholder where the map will go.
- Produces: the `/alerts` dashboard page (server component).

- [ ] **Step 1: Create `app/alerts/page.tsx`**

```tsx
import Link from "next/link";
import { CloudLightning, MapPinned } from "lucide-react";
import { getLiveRiskSummary } from "@/lib/live-risk";
import { getAlertStats, getRecentAlerts } from "@/lib/alert-stats";
import { RISK_LEVEL_LABELS } from "@/lib/risk-level";
import RegionRiskCard from "@/app/_components/region-risk-card";
import RecentAlerts from "@/app/_components/recent-alerts";
import ImpactBar from "@/app/_components/impact-bar";
import { RISK_LEVEL_STYLES } from "@/app/_components/risk-level-styles";

export const dynamic = "force-dynamic";
// Force dynamic: the page reads live (cached, but revalidating) weather data
// and DB stats; we never want a stale static prerender here.

export default async function AlertsPage() {
  const [summary, stats, recentAlerts] = await Promise.all([
    getLiveRiskSummary(),
    getAlertStats(),
    getRecentAlerts(8),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-3xl flex-col items-center">
        <div className="mb-8 w-full text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Live Storm Dashboard
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-secondary">
            Current storm and flood-risk across Ghana.
          </p>
        </div>

        <div className="mb-8 w-full">
          <ImpactBar
            stats={stats}
            regionsCovered={summary.regions.length}
            evaluatedAt={summary.evaluatedAt}
          />
        </div>

        <section className="mb-10 w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Regions
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.regions.map((region) => (
              <RegionRiskCard key={region.code} summary={region} />
            ))}
          </div>
        </section>

        {summary.catchments.map((catchment) => {
          const style = RISK_LEVEL_STYLES[catchment.level];
          const label = RISK_LEVEL_LABELS[catchment.level];
          return (
            <section key={catchment.code} className="mb-10 w-full">
              <div className="mb-3 flex items-center gap-2">
                <MapPinned size={15} className="text-earth" aria-hidden="true" />
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                  {catchment.displayName}
                </h2>
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${style.badge}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${style.dot}`}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              </div>
              <p className="text-[14px] text-ink-secondary">
                {catchment.waterwayName} catchment · {catchment.upstream.length}{" "}
                upstream watch points
              </p>
              {catchment.reasons.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {catchment.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="text-[13px] text-ink-muted"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <section className="mb-10 w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Recent alerts
          </h2>
          <RecentAlerts alerts={recentAlerts} />
        </section>

        <Link
          href="/"
          className="text-[13px] font-medium text-earth underline-offset-4 hover:underline"
        >
          Subscribe for SMS alerts
        </Link>

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
```

> A `<div className="h-64 ..." />` map placeholder slot is intentionally omitted here; Task 10 inserts `<CoverageMapLoader>` into the catchment section. If you want the slot visible now, add a `placeholder` block above the catchment list — deleted in Task 10.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/alerts/page.tsx
git commit -m "Add live storm dashboard route"
```

---

## Task 10: Leaflet coverage map

**Files:**
- Modify: `package.json` (add deps via pnpm)
- Create: `app/_components/coverage-map.tsx` (`'use client'`)
- Create: `app/_components/coverage-map-loader.tsx` (`'use client'`)
- Modify: `app/alerts/page.tsx` — render `<CoverageMapLoader>` in the catchment section.

**Interfaces:**
- Consumes: plain-serializable `regions: RegionRiskSummary[]` + `catchments: CatchmentRiskSummary[]`. `RISK_LEVEL_STYLES` for marker colors.
- Produces: `CoverageMapLoader`, which the server dashboard renders with plain props.

Verified compatibility: `react-leaflet@5.0.0` peers `react ^19.0.0`, `react-dom ^19.0.0`, `leaflet ^1.9.0` (registry.npmjs.org). Leaflet is browser-only → `ssr: false` dynamic import inside a Client Component.

- [ ] **Step 1: Install dependencies**

Run:
```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet
```
Expected: deps added to `package.json`; `leaflet@^1.9`, `react-leaflet@^5.0.0` resolved.

- [ ] **Step 2: Create `app/_components/coverage-map.tsx`**

```tsx
"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { RegionRiskSummary, CatchmentRiskSummary } from "@/lib/live-risk";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/risk-level";

interface Props {
  regions: RegionRiskSummary[];
  catchments: CatchmentRiskSummary[];
}

// Tailwind token → concrete hex (Leaflet Marker needs an icon; we render a colored dot
// divIcon so the map mirrors the dashboard's token-based palette).
const LEVEL_COLORS: Record<RiskLevel, string> = {
  warning: "#c53030",
  watch: "#9b3a2b",
  clear: "#3b7d4f",
  unknown: "#8a827d",
};

function dotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "storm-alert-map-dot",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(20,17,16,0.15)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const GHANA_CENTER: [number, number] = [7.95, -1.02];

export default function CoverageMap({ regions, catchments }: Props) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={GHANA_CENTER}
        zoom={6}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {regions.map((region) => (
          <Marker
            key={region.code}
            position={[region.lat, region.lon]}
            icon={dotIcon(LEVEL_COLORS[region.level])}
          >
            <Popup>
              <strong>{region.name}</strong>
              <br />
              {RISK_LEVEL_LABELS[region.level]}
            </Popup>
          </Marker>
        ))}

        {catchments.map((catchment) => (
          <Circle
            key={catchment.code}
            center={[catchment.lat, catchment.lon]}
            radius={catchment.radiusKm * 1000}
            pathOptions={{
              color: LEVEL_COLORS[catchment.level],
              fillColor: LEVEL_COLORS[catchment.level],
              fillOpacity: 0.15,
            }}
          >
            <Popup>
              <strong>{catchment.displayName}</strong>
              <br />
              {RISK_LEVEL_LABELS[catchment.level]}
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/_components/coverage-map-loader.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";
import type { RegionRiskSummary, CatchmentRiskSummary } from "@/lib/live-risk";

const CoverageMap = dynamic(() => import("./coverage-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-xl border border-border bg-ink/[0.02] text-[13px] text-ink-muted">
      Loading map…
    </div>
  ),
});

interface Props {
  regions: RegionRiskSummary[];
  catchments: CatchmentRiskSummary[];
}

export default function CoverageMapLoader(props: Props) {
  return <CoverageMap {...props} />;
}
```

- [ ] **Step 4: Wire the map into the dashboard**

In `app/alerts/page.tsx`, add the import and render the map. Insert above the catchment `<section>` list (after the Regions grid `</section>`):

Add to imports:
```tsx
import CoverageMapLoader from "@/app/_components/coverage-map-loader";
```

Insert after the Regions `</section>` closing tag:
```tsx
<section className="mb-10 w-full">
  <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
    Coverage map
  </h2>
  <CoverageMapLoader
    regions={summary.regions}
    catchments={summary.catchments}
  />
</section>
```

- [ ] **Step 5: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. The build is the real validation that the client-only Leaflet import + CSS import compile and the dynamic `ssr:false` wrapper is in a client component (it is — the loader is `'use client'`).

- [ ] **Step 6: Smoke-test in dev**

Run: `pnpm dev` then open `http://localhost:3000/alerts`.
Expected: dashboard renders; map markers appear after the client chunk loads; a failed tile still shows markers on the gray pane. (Manual check — not a test.)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml app/_components/coverage-map.tsx app/_components/coverage-map-loader.tsx app/alerts/page.tsx
git commit -m "Add Leaflet coverage map to dashboard"
```

---

## Task 11: Homepage impact bar + live risk chip

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/_components/subscribe-form.tsx`

**Interfaces:**
- Consumes: `getLiveRiskSummary`, `getAlertStats` from `lib`; `ImpactBar`, `RegionRiskChip`; `ServerComponent` renders the homepage, fetches summaries + stats, passes plain arrays to `SubscribeForm` (client) and `ImpactBar` (server).

- [ ] **Step 1: Update `app/_components/subscribe-form.tsx`**

Add an optional `regionSummaries` prop and render the chip under the region select (only affects the form; the success-state branch is unchanged).

Edit the component signature and add the chip. Add to imports (top of file):

```tsx
import RegionRiskChip from "./region-risk-chip";
import type { RegionRiskSummary } from "@/lib/live-risk";
```

Change the `export default function SubscribeForm()` signature to:

```tsx
export default function SubscribeForm({
  regionSummaries = [],
}: {
  regionSummaries?: RegionRiskSummary[];
}) {
```

Then, inside the geolocate `<div className="mt-3 text-center">` block (after the existing location/state-message block, before its closing `</div>`), add:

```tsx
{regionCode && regionSummaries.length > 0 && (
  <div className="mt-2 flex justify-center">
    <RegionRiskChip regionCode={regionCode} summaries={regionSummaries} />
  </div>
)}
```

- [ ] **Step 2: Update `app/page.tsx`**

```tsx
import Link from "next/link";
import { CloudLightning, MapPinned, ShieldOff } from "lucide-react";
import SubscribeForm from "./_components/subscribe-form";
import ImpactBar from "./_components/impact-bar";
import { getLiveRiskSummary } from "@/lib/live-risk";
import { getAlertStats } from "@/lib/alert-stats";

export default async function Home() {
  const [summary, stats] = await Promise.all([
    getLiveRiskSummary(),
    getAlertStats(),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-8 text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            StormAlert GH
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-secondary">
            Free SMS alerts for storms and floods in Ghana.
          </p>
        </div>

        <div className="mb-10 w-full">
          <ImpactBar
            stats={stats}
            regionsCovered={summary.regions.length}
            evaluatedAt={summary.evaluatedAt}
          />
        </div>

        <SubscribeForm regionSummaries={summary.regions} />

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-[13px] text-ink-muted">
          <span>Already subscribed?</span>
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1.5 font-medium text-earth underline-offset-4 transition-colors hover:text-earth-hover hover:underline focus-visible:rounded-md"
          >
            <MapPinned size={13} strokeWidth={1.8} aria-hidden="true" />
            View live dashboard
          </Link>
          <Link
            href="/update-alert-area"
            className="inline-flex items-center gap-1.5 font-medium text-earth underline-offset-4 transition-colors hover:text-earth-hover hover:underline focus-visible:rounded-md"
          >
            <MapPinned size={13} strokeWidth={1.8} aria-hidden="true" />
            Update alert area
          </Link>
          <Link
            href="/unsubscribe"
            className="inline-flex items-center gap-1.5 font-medium text-earth underline-offset-4 transition-colors hover:text-earth-hover hover:underline focus-visible:rounded-md"
          >
            <ShieldOff size={13} strokeWidth={1.8} aria-hidden="true" />
            Stop SMS alerts
          </Link>
        </div>

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
```

> The existing "Update alert area" / "Stop SMS alerts" links and copy are preserved verbatim — only the new "View live dashboard" link is added and `ImpactBar` + `regionSummaries` are wired in. The `SubscribeForm` is now rendered with a prop but its internal behavior is otherwise unchanged.

- [ ] **Step 3: Typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `pnpm test:run`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/_components/subscribe-form.tsx
git commit -m "Add impact bar and live region risk chip to homepage"
```

---

## Self-Review

**1. Spec coverage:**
- Live Storm Dashboard (`/alerts`) → Task 9 (route) + Task 8 (cards/recent/impact) + Task 10 (map). ✓
- Interactive Coverage Map (Leaflet, dashboard) → Task 10. ✓
- Region live-weather detail (`/region/[code]`) → Task 7. ✓
- Homepage impact bar + live risk chip → Task 11. ✓
- Backbone `lib/live-risk.ts` cached (~5 min revalidate, separate from cron no-store) → Tasks 3 + 4. ✓
- `AlertLog` feeds recent alerts + stats only → Task 5. ✓
- Risk levels warning/watch/clear/unknown → Task 1. ✓
- WMO code mapping → Task 2. ✓
- RSC boundaries: server fetch, `Promise.all` / `allSettled`, serialize Date→ISO, `ssr:false` only in client → Tasks 4, 5, 10. ✓
- Error handling: per-region `unknown` degradation, map-tile-failure-safe, DB-section graceful → Task 4 (allSettled→unknown), Task 10 (markers survive tile failure), Task 9 (sections independent). ✓
- Testing: risk-level, wmo-code-meta, live-risk summarize helpers → Tasks 1, 2, 4. ✓
- Verify-gates resolved (Previous caching model, `next.revalidate`, client loader for `ssr:false`, react-leaflet 5/React 19, leaflet CSS import) → Global Constraints + Tasks 3, 10. ✓
- No duplication: reuses `fetchPointForecast`, `evaluateAlertRisk`, `evaluateCatchmentAlertRisk`, `regions`, `catchments`, `getRegionByCode`, `getPrisma`, theme tokens, page shell pattern. ✓
- Cron untouched. ✓

**2. Placeholder scan:** No TBD/TODO. The Task 4 implementation note flags a readability nit (the `regionResults.indexOf` + `as Region` casts) with an explicit fallback ("build a parallel `{ region, result }` array instead") — that's guidance, not a placeholder. Task 9 has an explicit decision point about the map placeholder slot that Task 10 resolves. No gaps.

**3. Type consistency:**
- `RiskLevel` defined Task 1, used in Tasks 4, 6, 10 consistently. ✓
- `RegionRiskSummary` / `CatchmentRiskSummary` / `LiveRiskSummary` / `RegionDetail` defined Task 4, consumed in Tasks 6, 7, 8, 9, 10, 11 with matching field names (`code`, `level`, `reasons`, `metrics`, `evaluatedAt`, `upstream`). ✓
- `AlertStats` / `RecentAlert` defined Task 5, consumed Task 8 (RecentAlerts, ImpactBar) and 9, 11. `triggeredAt` is ISO string throughout. ✓
- `FetchPointForecastOptions` (Task 3) — `fetchPointForecast(point, { revalidate })` called identically in Task 4. ✓
- `deliverRiskLevel(region, evaluation)` signature matches between Task 1 (definition) and Task 4 (callers). ✓
- `coverage-map-loader` → `coverage-map` prop names (`regions`, `catchments`) match between Tasks 9, 10, 11. ✓

No issues found.
