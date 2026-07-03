# Live Storm Awareness Layer — Design

**Status:** Approved (2026-07-03)
**Branch:** `feat/live-storm-dashboard`

## Goal

Surface the weather-risk data StormAlert GH already computes but never shows in the UI — turning hidden `AlertLog` history and on-demand Open-Meteo evaluation into four product surfaces:

1. **Live Storm Dashboard** (`/alerts`)
2. **Interactive Coverage Map** (Leaflet, on the dashboard)
3. **Region live-weather detail** (`/region/[code]`)
4. **Homepage impact bar + live risk chip** (`/`)

## Guiding principle — do not duplicate, follow existing patterns

The risk layer reuses the existing, already-tested building blocks rather than re-implementing evaluation:

- `lib/weather-client.ts` → `fetchPointForecast` / `fetchRegionForecast`
- `lib/alert-evaluator.ts` → `evaluateAlertRisk` / `evaluateCatchmentAlertRisk`
- `lib/regions.ts` → `regions`, `getRegionByCode`
- `lib/catchments.ts` → `catchments`, catchment config

New code is additive data-assembly + UI; the domain logic is not forked. New modules follow repo conventions:

- Server-only modules begin with `import "server-only"` (as `weather-client.ts` does).
- Tests are co-located `lib/*.test.ts` using Vitest, matching `alert-evaluator.test.ts` / `rate-limit.test.ts`.
- UI uses the existing Tailwind theme tokens (`canvas`, `ink`, `ink-secondary`, `ink-muted`, `border`, `earth`, `earth-hover`, `success`, `error`) and `lucide-react` icons.
- Pages follow the existing shell pattern: `<main className="flex min-h-dvh flex-col items-center ...">` with the centered `max-w-2xl` column and the `CloudLightning` footer line.

## Architecture & data flow

### Backbone: `lib/live-risk.ts` (server-only)

A new module that computes current risk for all 16 regions plus the Odaw catchment. It calls `fetchPointForecast` (+ `fetchRegionForecast`), then runs `evaluateAlertRisk` / `evaluateCatchmentAlertRisk`, and returns a compact summary per region.

Key constraint — **separate cache path from the cron.** The cron in `app/api/cron/poll-weather/route.ts` calls `fetchPointForecast` with `cache: "no-store"` so every scheduled poll is fresh. The live-risk module must NOT alter that. It achieves a short shared cache via Next's fetch revalidation on its own calls (target `revalidate` window of **~300s / 5 min**), so one cache window serves all visitors without touching the cron. (Exact revalidation mechanism to be confirmed from the bundled Next.js 16 docs — see Verify Before Implement.)

> `AlertLog` only records alerts that *fired*, so it cannot answer "what is the risk right now." Current risk is always computed live (cached). `AlertLog` feeds only the recent-alerts timeline and alert stats.

### Risk-level derivation — `deriveRiskLevel(evaluation)` (pure, unit-tested)

Maps an `AlertEvaluation` to one of four levels:

| Level        | Condition                                                                       |
| ------------ | ------------------------------------------------------------------------------- |
| `warning`    | `evaluation.triggered === true`                                                 |
| `watch`      | Not triggered but elevated: precip probability ≥ 60%; **or** any metric ≥ ~50% of its threshold; **or** a rain/storm WMO code present |
| `clear`      | All metrics low                                                                 |
| `unknown`    | Fetch/eval failed for that region (degraded, never blanks the dashboard)        |

This is a pure function — no I/O — so it is trivially unit-tested alongside `alert-evaluator.test.ts`.

### Data strategy: on-demand + cache (Approach 1)

No new `RiskSnapshot` model, no DB migration, no cron changes. Live risk is fetched + evaluated on-demand and cached ~5 min. `AlertLog` (read-only queries) powers history/stats. This ships fastest and avoids churn in the recently-hardened cron.

## Surfaces & modifications

### 1. Live Storm Dashboard — `app/alerts/page.tsx` (server component)

Layout: header (overall "last checked" + next-update-in) → 16-region risk grid → Odaw catchment flood callout → interactive coverage map → recent-alerts timeline.

- Risk grid: 16 `RegionRiskCard`s, color-coded by level, each linking to `/region/[code]`.
- Recent-alerts timeline: reads latest N `AlertLog` rows (region, trigger reason, time, recipients). Timestamps are serialized to ISO on the server before reaching any client-rendered piece.
- Catchment callout: shows Odaw risk + upstream watch points (Aburi Ridge, Ashongman, Madina) using `evaluateCatchmentAlertRisk`.
- All sections degrade independently (see Error Handling).

### 2. Coverage Map — `app/_components/coverage-map.tsx` (client)

- `react-leaflet` + `leaflet`, **dynamically imported with `ssr: false`** on the dashboard (Leaflet is browser-only).
- Tiles: **CartoDB Positron** (light, matches minimal theme) with attribution. Low-stakes, swappable.
- Props: plain-serializable region summaries + catchment config (lat/lon codes + risk levels). Clicking a region marker navigates to `/region/[code]`.
- Odaw catchment rendered as a circle (`impactRadiusKm` from `catchments.ts`), colored by catchment risk.

### 3. Region detail — `app/region/[code]/page.tsx` (server component)

- Dynamic route using async `params` (matches the `verify/page.tsx` async `searchParams` pattern).
- Shows that region's live hourly forecast strip (`HourlyForecastStrip`) + metrics + reasons from `evaluateAlertRisk`.
- If the region contains a catchment (Accra → Odaw), shows upstream watch points and their individual risk.
- Unknown region → `notFound()`.

### 4. Homepage update — `app/page.tsx` + `app/_components/`

- Impact bar: active subscribers count, alerts-sent count (from `AlertLog`), regions covered (16), last-checked time. Server-rendered.
- Live risk chip on the selected region in `SubscribeForm` (`RegionRiskChip`, client) — receives a compact region-summary object as props.

## New components

| Component                    | Type   | Notes                                                                 |
| ---------------------------- | ------ | --------------------------------------------------------------------- |
| `RegionRiskCard`             | server | presentational; level color + link                                    |
| `HourlyForecastStrip`        | server | time / WMO icon / precip bar / wind                                    |
| `RecentAlerts`               | server | AlertLog feed; Dates → ISO on server                                   |
| `ImpactBar`                  | server | subscribers/alerts/regions/last-checked                                |
| `RegionRiskChip`             | client | homepage selected-region chip; plain props only                        |
| `CoverageMap`                | client | `next/dynamic` import, `ssr: false`; react-leaflet                     |

## New lib modules

| Module                  | Notes                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `lib/live-risk.ts`      | `import "server-only"`; cached region + catchment risk computation       |
| `lib/wmo-code-meta.ts`  | WMO code → `{ label, lucide icon }` mapping (used by strip + cards)     |
| `lib/risk-level.ts`     | `deriveRiskLevel(evaluation)` pure function + level metadata (colors)   |

## New dependencies

- `leaflet`, `react-leaflet`, `@types/leaflet` — the app's first map dependency.

## Error handling

- Per-region fetch failure → that region renders **unknown** (muted, with tooltip); the rest render normally.
- Map tile failure → markers still render on the gray Leaflet pane (no hard dependency on tiles).
- DB query failure (impact bar / recent alerts) → that section hides gracefully; the risk grid (no DB dependency) keeps the dashboard useful.
- If "last checked" exceeds the cache window + buffer, show a "data may be stale" note.
- No section's failure takes down the page; each is an independent Suspense-able unit where it fetches.

## RSC boundary rules (from next-best-practices + vercel-react)

- Server Components fetch directly — no internal API route for reads (fewer endpoints, secrets stay server-side).
- Fetch the 16 regions + catchment in parallel with `Promise.all` (no waterfall).
- Pass only plain-serializable props to client components; serialize `Date` → ISO string on the server.
- Heavy/rare client code (Leaflet) via `next/dynamic`, `ssr: false`.

## Testing

Following the existing Vitest style (`alert-evaluator.test.ts`, `rate-limit.test.ts`):

- `lib/risk-level.test.ts` — `deriveRiskLevel` across warning/watch/clear/unknown.
- `lib/wmo-code-meta.test.ts` — code → label/icon coverage for relevant codes.
- `lib/live-risk.test.ts` — region + catchment summary shape; network fetches mocked (Open-Meteo responses stubbed).
- UI component layer kept thin/presentational, mirroring how current pages are server-rendered shells over tested lib logic.

## Phased build order (implementation plan)

1. **Foundation** — `lib/risk-level.ts` + `deriveRiskLevel` + tests; `lib/wmo-code-meta.ts` + tests; `lib/live-risk.ts` cached computation + tests.
2. **Region detail page** (`/region/[code]`) + `HourlyForecastStrip` — cheapest visible surface that validates the data layer.
3. **Dashboard** (`/alerts`) — region grid + recent-alerts timeline + catchment callout + impact bar.
4. **Coverage map** (Leaflet) integrated into the dashboard.
5. **Homepage** impact bar + live risk chip.

## Verify before implementing (explicit gates)

These are read-the-authoritative-source before writing the relevant code — per `AGENTS.md` (bundled Next.js 16 docs in `node_modules/next/dist/docs/`) and dependency compatibility:

1. **Fetch revalidation mechanism in Next.js 16** — confirm how to set a ~5-min shared revalidation window on the live-risk fetches (vs the cron's `no-store`). Read the relevant bundled caching/data doc first.
2. **Client-only dynamic import in Next.js 16** — confirm `next/dynamic` with `ssr: false` is the correct mechanism for the Leaflet map (or its current equivalent).
3. **`react-leaflet` compatibility with React 19** — confirm peer-compat / install the compatible versions; add `leaflet` CSS import in the correct place (the bundling guide notes CSS imports over `<link>`).
4. **Leaflet CSS** — confirm the correct way to load `leaflet/dist/leaflet.css` in a Next.js 16 client component (import vs global).

## Out of scope (YAGNI)

- Public JSON risk API endpoint.
- Persisted risk history / `RiskSnapshot` model (the Approach 2 upgrade — revisit if traffic grows).
- Push / in-app notifications (project is SMS-first).
- Pan/zoom beyond what Leaflet gives for free; no custom tile server.
