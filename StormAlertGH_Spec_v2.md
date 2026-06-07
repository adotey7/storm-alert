# ⛈ StormAlert GH

**Real-Time Storm & Flood SMS Alert System for Ghana**

*Project Specification — v2.0 — Open Source (MIT)*

| | |
|---|---|
| **Status** | Hobby / Open Source — Active Development |
| **Author** | Chris (Adotey7) • Ghana |
| **Frontend & API** | Next.js 14 App Router |
| **Database** | Neon Serverless Postgres (free tier) |
| **ORM** | Prisma |
| **Cron** | GitHub Actions scheduled workflow (free for public repos) |
| **Hosting** | Vercel (free tier) |
| **SMS** | Arkesel |
| **Weather** | Open-Meteo (free, no key required) |
| **License** | MIT |

---

## 1. Overview

StormAlert GH is a lightweight, fully serverless, open-source system that monitors real-time weather data for Ghanaian regions and dispatches SMS alerts to subscribers when dangerous storm or flood-risk conditions are detected. The entire project runs on free-tier services, making it sustainable as a hobby project with zero ongoing infrastructure cost.

### 1.1 Problem Statement

Ghana experiences severe flooding, particularly in Greater Accra, Central, and Western regions, during the rainy seasons (April–July and September–November). Weather warnings are often confined to TV/radio or social media and do not reach people proactively. StormAlert GH addresses this gap with a simple opt-in SMS notification service.

### 1.2 Goals

- Send timely SMS alerts when weather thresholds (heavy rain, flood risk) are met in a subscriber's region.
- Run entirely on free-tier infrastructure — zero ongoing cost.
- Single Next.js monorepo — one language, one deploy, one repo.
- Forkable for other countries by editing `regions.json` only.
- Privacy-first — no accounts, phone number + region only.

### 1.3 Non-Goals

- Not a government or emergency-grade system. Not a replacement for official GMet alerts.
- No mobile app — SMS works on all phones including feature phones.
- No monetisation in v1.

---

## 2. System Architecture

The system is fully serverless. There is no persistent process. All backend logic lives in Next.js API Route Handlers. A GitHub Actions scheduled workflow acts as the cron trigger, calling a protected API route every 30 minutes.

**Data Flow:**

```
GitHub Actions (every 30 min)
  → GET /api/cron/poll-weather  [x-cron-secret header]
     → Fetch Open-Meteo data for each configured region
     → Evaluate thresholds (alertEvaluator.ts)
     → Check cooldown window in Neon (alert_logs)
     → Query active subscribers by region (Neon via Prisma)
     → POST Arkesel SMS API
     → Write alert_log entry to Neon

User → Next.js Subscribe Page → POST /api/subscribe → Neon
Arkesel Webhook → POST /api/webhooks/arkesel → Unsubscribe
```

### 2.1 Module Breakdown

#### 2.1.1 GitHub Actions Scheduler

A `.github/workflows/poll.yml` workflow with a cron schedule of `*/30 * * * *`. It fires a curl request to the Vercel-hosted poll route. Public repo Actions have unlimited free minutes, making this the ideal zero-cost cron solution. The workflow also supports `workflow_dispatch` for manual testing.

#### 2.1.2 `/api/cron/poll-weather` (Route Handler)

Validates the `x-cron-secret` header, then iterates over all regions in `regions.json`. For each region, it fetches Open-Meteo hourly forecast data, runs the alert evaluator, and calls the SMS dispatcher if thresholds are exceeded and the cooldown window has passed.

#### 2.1.3 Alert Evaluator (`lib/alertEvaluator.ts`)

Pure TypeScript function. Accepts a weather payload and a region threshold config. Returns a boolean and a human-readable trigger reason string. No DB access — easy to unit test.

#### 2.1.4 SMS Dispatcher (`lib/smsDispatcher.ts`)

Wraps the Arkesel REST API. Accepts an array of phone numbers and a message string. Returns a delivery report. Called only after the evaluator confirms a threshold breach and the cooldown check passes.

#### 2.1.5 Subscription API Routes

Three Route Handlers: `POST /api/subscribe` (create subscriber + send OTP), `POST /api/verify` (confirm OTP), `POST /api/unsubscribe`. A fourth webhook handler at `/api/webhooks/arkesel` processes inbound STOP replies from Arkesel.

#### 2.1.6 Subscribe Frontend (Next.js App Router Pages)

Two pages: the root subscribe form (`/`) and an OTP verification page (`/verify`). Mobile-first, Tailwind CSS only. The subscription form optionally uses the browser Geolocation API to auto-suggest the nearest configured region.

---

## 3. Data Model

Hosted on Neon serverless Postgres. Managed with Prisma ORM and Prisma Migrate.

> **Neon Connection Strings:** `DATABASE_URL` should use the pooled connection string. `DATABASE_URL_UNPOOLED` should use the direct (non-pooled) string. In `schema.prisma`, add:
> ```prisma
> datasource db {
>   url       = env("DATABASE_URL")
>   directUrl = env("DATABASE_URL_UNPOOLED")
> }
> ```

### 3.1 `subscribers`

| Column | Type | Description |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `phone` | String | E.164 format (+233...). Unique index. |
| `region_code` | String | FK to a key in `regions.json` |
| `active` | Boolean | `false` = unsubscribed (soft delete) |
| `created_at` | DateTime | Subscription timestamp |
| `verified_at` | DateTime? | Null until OTP confirmed |

### 3.2 `otp_codes`

| Column | Type | Description |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `phone` | String | Target phone number |
| `code` | String | 6-digit numeric OTP |
| `expires_at` | DateTime | `created_at` + 10 minutes |
| `used` | Boolean | Prevents OTP reuse |

### 3.3 `alert_logs`

| Column | Type | Description |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `region_code` | String | Affected region |
| `triggered_at` | DateTime | Alert dispatch timestamp |
| `trigger_reason` | String | e.g. `"precipitation_mm > 50"` |
| `recipients_count` | Int | Number of SMS recipients |
| `weather_snapshot` | Json | Raw Open-Meteo payload at trigger time |

---

## 4. Alert Thresholds

Thresholds live in `src/config/regions.json` and are loaded at runtime. No code changes are needed to adjust sensitivity. Each region can define its own values to reflect local drainage and topography.

### 4.1 Default Thresholds (Accra)

| Metric (Open-Meteo field) | Threshold | Notes |
|---|---|---|
| `precipitation_sum` (1h) | > 20 mm | Heavy rain within an hour |
| `precipitation_sum` (3h) | > 50 mm | Sustained heavy rainfall |
| `precipitation_probability` | > 85% | High-confidence forecast |
| `wind_speed_10m` | > 60 km/h | Storm-force winds |
| `weathercode` | 61, 63, 65, 80–82, 95–99 | WMO: heavy rain, thunderstorms |

### 4.2 `regions.json` Shape

```json
{
  "accra": {
    "name": "Greater Accra",
    "lat": 5.6037,
    "lon": -0.1870,
    "thresholds": {
      "precipitation_1h_mm": 20,
      "precipitation_3h_mm": 50,
      "precipitation_probability": 85,
      "wind_speed_kmh": 60,
      "wmo_codes": [61, 63, 65, 80, 81, 82, 95, 96, 99]
    }
  },
  "kumasi": {
    "name": "Ashanti Region",
    "lat": 6.6885,
    "lon": -1.6244,
    "thresholds": { "...": "..." }
  },
  "tamale": {
    "name": "Northern Region",
    "lat": 9.4008,
    "lon": -0.8393,
    "thresholds": { "...": "..." }
  }
}
```

---

## 5. GitHub Actions Cron

GitHub Actions replaces a traditional cron daemon. The scheduled workflow calls the protected Next.js API route every 30 minutes. Because the repo is public, this is completely free with no cap on runs.

### 5.1 `.github/workflows/poll.yml`

```yaml
name: Weather Poll

on:
  schedule:
    - cron: '*/30 * * * *'  # every 30 minutes
  workflow_dispatch:          # manual trigger for testing

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Call poll route
        run: |
          curl --fail --silent \
            -X GET "${{ secrets.APP_URL }}/api/cron/poll-weather" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

### 5.2 GitHub Repo Secrets Required

| Secret | Value |
|---|---|
| `APP_URL` | `https://your-app.vercel.app` (no trailing slash) |
| `CRON_SECRET` | Long random string, must match `CRON_SECRET` env var on Vercel |

### 5.3 Route Protection Pattern

```ts
// app/api/cron/poll-weather/route.ts
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // poll logic here...
  return Response.json({ regions_checked: 10, alerts_sent: 1 });
}
```

---

## 6. API Route Reference

### `POST /api/subscribe`

```
Body:  { "phone": "+233244123456", "region_code": "accra" }

201:   { "message": "Subscribed. Confirm via SMS." }
409:   { "error": "Already subscribed." }
422:   { "error": "Invalid phone number format." }
```

### `POST /api/verify`

```
Body:  { "phone": "+233244123456", "otp": "492831" }

200:   { "message": "Phone verified. Alerts active." }
400:   { "error": "Invalid or expired OTP." }
```

### `POST /api/unsubscribe`

```
Body:  { "phone": "+233244123456" }

200:   { "message": "Unsubscribed successfully." }

// Also triggered by replying STOP to any SMS (via Arkesel webhook)
```

### `GET /api/cron/poll-weather`

```
Headers: x-cron-secret: <CRON_SECRET>

200:   { "regions_checked": 10, "alerts_sent": 1 }
401:   { "error": "Unauthorized" }
```

### `POST /api/webhooks/arkesel`

```
// Arkesel calls this when a subscriber replies STOP
Body:  { "from": "+233244123456", "message": "STOP" }

200:   { "message": "Unsubscribed." }
```

---

## 7. SMS Message Templates

### 7.1 Storm Alert

```
⚠️ STORM ALERT - Greater Accra
Heavy rain expected: 55mm/3hr.
Stay indoors, avoid flooded roads.
StormAlert GH. Reply STOP to opt out.
```

### 7.2 OTP Confirmation

```
StormAlert GH: Your code is 492831.
Enter it to confirm alerts for
Greater Accra. Expires in 10 mins.
```

### 7.3 Unsubscribe Confirmation

```
You have been unsubscribed from
StormAlert GH alerts. Stay safe.
```

---

## 8. Repository Structure

```
storm-alert-gh/
├── .github/
│   └── workflows/
│       └── poll.yml              # Scheduled cron trigger
├── app/
│   ├── page.tsx                  # Subscribe form (homepage)
│   ├── verify/page.tsx           # OTP verify page
│   └── api/
│       ├── subscribe/route.ts
│       ├── verify/route.ts
│       ├── unsubscribe/route.ts
│       ├── cron/
│       │   └── poll-weather/route.ts
│       └── webhooks/
│           └── arkesel/route.ts  # Inbound STOP handler
├── lib/
│   ├── alertEvaluator.ts         # Threshold comparison (pure fn)
│   ├── smsDispatcher.ts          # Arkesel API wrapper
│   ├── weatherClient.ts          # Open-Meteo API wrapper
│   └── db.ts                     # Prisma client singleton
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/config/
│   └── regions.json              # Regions + thresholds config
├── .env.example
├── README.md
└── LICENSE
```

---

## 9. Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (runtime queries) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (Prisma Migrate only) |
| `CRON_SECRET` | Long random string — must match GitHub Actions secret |
| `ARKESEL_API_KEY` | Arkesel SMS API key |
| `ARKESEL_SENDER_ID` | Registered sender name, e.g. `StormGH` |
| `ALERT_COOLDOWN_HOURS` | Min hours between alerts per region (default: `6`) |
| `OTP_EXPIRY_MINUTES` | OTP validity window (default: `10`) |
| `NEXT_PUBLIC_APP_NAME` | Shown in UI (default: `StormAlert GH`) |

---

## 10. Development Milestones

### Milestone 1 — Foundation (Week 1–2)

- Init Next.js 14 App Router project with TypeScript and Tailwind CSS.
- Set up Neon project, Prisma schema, and run initial migration.
- Implement Open-Meteo weather client and Alert Evaluator.
- Build `/api/cron/poll-weather` with secret protection.
- **Goal:** `curl` to the poll route logs threshold evaluations for all 10 regions.

### Milestone 2 — SMS Integration (Week 3)

- Integrate Arkesel API in `lib/smsDispatcher.ts`.
- Implement `/api/subscribe`, `/api/verify`, and `/api/unsubscribe` routes.
- OTP generation, storage, and expiry logic.
- **Goal:** A real Ghanaian number receives a test SMS alert for Accra.

### Milestone 3 — GitHub Actions Cron (Week 4)

- Add `.github/workflows/poll.yml`.
- Configure `APP_URL` and `CRON_SECRET` in GitHub repo secrets.
- Migrate thresholds to `regions.json` with all 10 major regions.
- Implement cooldown check via `alert_logs` table.
- **Goal:** GitHub Actions runs automatically every 30 minutes and Action logs confirm successful polls.

### Milestone 4 — Subscribe Frontend (Week 5–6)

- Build Next.js subscribe page and OTP verify page.
- Geolocation auto-suggest for region selection.
- Mobile-first Tailwind CSS design.
- Implement Arkesel inbound webhook at `/api/webhooks/arkesel` for STOP handling.

### Milestone 5 — Open Source Polish (Week 7)

- Write README: local setup, deploy guide, and fork-for-your-country instructions.
- Complete `.env.example` with all variables and descriptions.
- Publish repository as public on GitHub under MIT license.

---

## 11. Free Tier Limits Reference

| Service | Free Limit | Expected Usage | Safe? |
|---|---|---|---|
| Vercel | Serverless — no persistent process limit | Triggered by GH Actions only | ✓ Yes |
| Neon | 0.5 GB storage, 190 compute hrs/mo | Well under for hobby scale | ✓ Yes |
| GitHub Actions | Unlimited (public repo) | ~1,440 runs/month | ✓ Yes |
| Open-Meteo | Unlimited (open source API) | ~1,440 calls/month | ✓ Yes |
| Arkesel | Pay per SMS sent only | Cost only when alert fires | * Note |

\* Arkesel charges per SMS sent, not per API call. At low subscriber counts this is negligible. API key registration and inbound webhooks are free.

---

## 12. Future Extensions

| Feature | Notes |
|---|---|
| WhatsApp alerts | Arkesel supports WhatsApp Business — same API key |
| Admin dashboard | Next.js page: subscriber count, alert history, manual trigger button |
| Alert severity levels | Yellow / Orange / Red with different message copy |
| GMet API integration | Swap Open-Meteo if Ghana Met Agency publishes a public API |
| Multi-country fork guide | `regions.json` approach already supports this cleanly |
| USSD subscription | Fallback for users without internet access |

---

*StormAlert GH is dedicated to communities in Ghana who face seasonal flooding without adequate advance warning. Build it. Share it. Stay safe.*

---

*Open Source • MIT License*
