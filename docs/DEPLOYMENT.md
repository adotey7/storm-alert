# Deployment

StormAlert GH is designed for Vercel, Neon Postgres, Arkesel, and GitHub Actions.

## 1. Database

Create a Neon project and copy:

- pooled connection string -> `DATABASE_URL`
- direct connection string -> `DIRECT_URL`

Run migrations locally or in a trusted environment:

```bash
pnpm prisma:migrate
```

For production deploys, use:

```bash
pnpm prisma:deploy
```

## 2. Vercel

Add the environment variables from `.env.example` to the Vercel project.

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `CRON_SECRET`
- `ARKESEL_API_KEY`
- `ARKESEL_SENDER_ID`
- `ARKESEL_API_BASE_URL`
- `OTP_PEPPER`
- `NEXT_PUBLIC_ARKESEL_USSD_CODE`

Redeploy after changing environment variables.

## 3. GitHub Actions Cron

Add repository secrets:

```text
APP_URL=https://your-domain.example
CRON_SECRET=the-same-secret-used-in-vercel
```

The workflow in `.github/workflows/poll.yml` calls:

```text
GET /api/cron/poll-weather
```

with the `x-cron-secret` header.

## 4. Arkesel Webhook

Configure inbound STOP replies to call:

```text
https://your-domain.example/api/webhooks/arkesel
```

## 5. Smoke Test

After deploying:

1. Subscribe with a real Ghana phone number.
2. Verify via SMS OTP.
3. Verify the USSD fallback guidance appears on `/verify`.
4. Reply `STOP` and confirm the subscriber becomes inactive.
5. Manually trigger the GitHub Actions workflow.
