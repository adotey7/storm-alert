# StormAlert GH Stack Facts - 2026 Baseline

Created: 2026-06-06

This file records the verified stack baseline to use before setting up the project. It updates the assumptions in `StormAlertGH_Spec_v2.md` without replacing the original product spec.

## Recommended Baseline

StormAlert GH should be treated as a modern serverless Next.js application:

- Frontend and API: Next.js App Router
- Runtime: Node.js
- UI styling: Tailwind CSS
- Database: Neon Serverless Postgres
- ORM: Prisma
- Weather data: Open-Meteo
- SMS and OTP: Arkesel
- Scheduled polling: GitHub Actions calling a protected route
- Hosting: Vercel

## Current Package Snapshot

These were checked on 2026-06-06:

| Area | Current Fact | Project Impact |
|---|---|---|
| Next.js | Latest stable checked: `16.2.7` | Use Next.js 16, not the spec's older Next.js 14 baseline. |
| React | Latest checked: `19.2.7` for `react` and `react-dom` | Fits a new Next.js 16 app. |
| Tailwind CSS | Latest checked: `4.3.0` | Tailwind is still right, but v4 setup differs from older v3 config patterns. |
| TypeScript | Latest checked: `6.0.3` | Use the version selected by current Next tooling unless there is a compatibility reason to pin. |
| ESLint | Latest checked: `10.4.1` | Use current Next-compatible ESLint setup. `next lint` is not the modern path. |
| Prisma | Latest checked: `7.8.0` | The spec's Prisma datasource example is stale for Prisma 7. |
| Local Node | Workspace has Node `v22.19.0` | Meets current Next.js and Prisma requirements. |
| Local npm | Workspace has npm `10.9.3` | Good enough for setup. |

## Key Corrections To The Original Spec

### Next.js

The original spec says Next.js 14. For a fresh build, use Next.js 16.

Current Next.js setup defaults are aligned with this project:

- App Router
- TypeScript
- Tailwind CSS
- ESLint or Biome selection
- Turbopack as the default bundler
- Route Handlers for backend endpoints

Route Handlers are still the right model for:

- `POST /api/subscribe`
- `POST /api/verify`
- `POST /api/unsubscribe`
- `GET /api/cron/poll-weather`
- `POST /api/webhooks/arkesel`

The cron route reads request headers, fetches network data, queries the database, and sends SMS, so it should be treated as a dynamic server route.

### Prisma

The spec's older Prisma datasource shape should not be copied as-is:

```prisma
datasource db {
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
```

For Prisma 7, datasource URL configuration belongs in `prisma.config.ts`, not directly in `schema.prisma` in the old style. For PostgreSQL, Prisma 7 also expects the driver adapter path, such as `@prisma/adapter-pg`, when creating the Prisma Client.

Practical implication:

- Keep Prisma schema focused on models and provider configuration.
- Put database connection config in `prisma.config.ts`.
- Use a pooled Neon URL for application runtime.
- Use a direct Neon URL for migration/CLI operations.
- Re-check exact Prisma 7 config shape during setup before writing the files.

### Neon

Neon remains a good fit, but the free-tier numbers in the original spec should be refreshed.

Current checked free-plan facts:

- Storage: `0.5 GB` per project
- Compute: `100 CU-hours` per project

The important architecture choice is unchanged:

- Runtime app queries should use the pooled Neon connection string.
- Prisma migrations should use a direct, unpooled connection string.

Suggested env naming for clarity:

```ini
DATABASE_URL="pooled Neon connection string"
DIRECT_URL="direct Neon connection string for Prisma CLI/migrations"
```

### Open-Meteo

Open-Meteo is still a strong fit because it offers a free/open-access weather API and supports forecast variables needed for storm and flood-risk evaluation.

The original spec says "unlimited." That should be softened.

Current checked free/open-access limits:

- `600` calls per minute
- `5,000` calls per hour
- `10,000` calls per day
- `300,000` calls per month

StormAlert GH's expected use is far below this if we poll roughly 10 regions every 30 minutes:

- About `480` weather calls per day
- About `14,400` weather calls per 30-day month

That is safe against the checked Open-Meteo free/open-access limits.

### GitHub Actions

GitHub Actions is still a good zero-cost scheduler for a public repository using standard GitHub-hosted runners.

Important caveats:

- Scheduled workflows only run from the default branch.
- Scheduled workflows are not hard real-time.
- Public repository scheduled workflows can be disabled after 60 days of repository inactivity.

The every-30-minutes schedule remains reasonable:

```yaml
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:
```

### Vercel

Vercel remains a good hosting target for this architecture.

Current checked function duration docs show Hobby functions with a 300 second default and maximum duration. That is enough for the weather polling route if we keep it efficient and avoid slow serial work where possible.

Implementation note:

- The poll route should fetch region weather data carefully.
- If the region count grows, use controlled concurrency rather than fully serial polling or unbounded parallelism.
- The route should return a concise JSON summary for GitHub Actions logs.

### Arkesel

Arkesel remains aligned with the SMS and OTP requirements.

Verified capabilities from current docs:

- SMS REST API
- Alerts and notifications via SMS
- OTP generation/verification support
- SMS status checks
- API key authentication
- SMS V2 uses API key in a header
- Sandbox environment exists for testing

Open implementation question:

- The exact inbound STOP/webhook payload should be verified directly when implementing unsubscribe-by-reply. The original spec's payload shape is a good placeholder, not yet a confirmed contract.

## Updated Build Interpretation

The product plan remains the same:

1. Let users subscribe with phone number plus region.
2. Verify phone numbers by OTP.
3. Poll weather data for Ghanaian regions on a schedule.
4. Evaluate configurable thresholds from `regions.json`.
5. Respect cooldown windows per region.
6. Send SMS alerts through Arkesel only when conditions warrant it.
7. Store alert logs and subscriber state in Neon.

The updated technical baseline is:

```txt
Next.js 16
React 19
Tailwind CSS 4
Prisma 7
Neon Postgres
Vercel
GitHub Actions
Open-Meteo
Arkesel
```

## Sources Checked

- Next.js installation docs: https://nextjs.org/docs/app/getting-started/installation
- Next.js route handlers docs: https://nextjs.org/docs/app/getting-started/route-handlers
- npm `next`: https://registry.npmjs.org/next/latest
- npm `react`: https://registry.npmjs.org/react/latest
- npm `tailwindcss`: https://registry.npmjs.org/tailwindcss/latest
- npm `typescript`: https://registry.npmjs.org/typescript/latest
- npm `eslint`: https://registry.npmjs.org/eslint/latest
- npm `prisma`: https://registry.npmjs.org/prisma/latest
- Prisma 7 upgrade guide: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- Neon Prisma guide: https://neon.com/docs/guides/prisma
- Neon pricing: https://neon.com/pricing
- Vercel function duration docs: https://vercel.com/docs/functions/configuring-functions/duration
- GitHub Actions billing docs: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub Actions scheduled workflow docs: https://docs.github.com/en/actions/reference/events-that-trigger-workflows
- Open-Meteo docs: https://open-meteo.com/en/docs
- Open-Meteo pricing: https://open-meteo.com/en/pricing
- Arkesel API docs: https://developers.arkesel.com/
- Arkesel OpenAPI spec: https://developers.arkesel.com/spec/api_spec.v2.3.1.yaml
