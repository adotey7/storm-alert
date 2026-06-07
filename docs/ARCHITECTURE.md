# Architecture

StormAlert GH is a serverless Next.js application with route handlers for subscription, verification, unsubscribe, inbound SMS webhooks, and scheduled weather polling.

## Runtime Flow

```text
User
  -> /
  -> POST /api/subscribe
  -> Arkesel OTP
  -> /verify
  -> POST /api/verify
  -> Neon Postgres
```

```text
GitHub Actions
  -> GET /api/cron/poll-weather
  -> Open-Meteo forecast
  -> alert evaluator
  -> Arkesel SMS
  -> alert log
```

## Main Modules

- `app/api/subscribe/route.ts`: validates phone and region, creates or updates pending subscriber, starts OTP.
- `app/api/verify/route.ts`: verifies OTP and activates subscriber.
- `app/api/unsubscribe/route.ts`: soft-unsubscribes a phone number.
- `app/api/webhooks/arkesel/route.ts`: handles inbound STOP replies.
- `app/api/cron/poll-weather/route.ts`: protected scheduled weather polling endpoint.
- `lib/alert-evaluator.ts`: pure threshold evaluator.
- `lib/weather-client.ts`: Open-Meteo client.
- `lib/arkesel-otp.ts`: Arkesel OTP generate/verify client.
- `lib/sms-dispatcher.ts`: Arkesel SMS sender.
- `lib/prisma.ts`: Prisma singleton.

## Database

The database has three core models:

- `Subscriber`: phone, region, active state, verification timestamp.
- `OtpCode`: local development fallback OTP hashes.
- `AlertLog`: triggered weather alerts and snapshots.

## Secrets

Secrets are server-only and must not be exposed to client components. Only `NEXT_PUBLIC_*` values are browser-visible.
