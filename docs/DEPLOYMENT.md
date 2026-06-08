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
- `ARKESEL_WEBHOOK_SECRET`
- `OTP_PEPPER`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_ARKESEL_USSD_CODE`

Redeploy after changing environment variables.

## 3. GitHub Actions

The repository includes two workflows:

- `.github/workflows/ci.yml` runs linting, type-checking, tests, and production build checks.
- `.github/workflows/poll.yml` calls the protected weather polling route every 30 minutes.

After pushing the repository to GitHub, protect `main` with a repository ruleset and require the `CI / Lint, test, and build` check before merging.

## 4. GitHub Actions Cron

Add repository secrets in GitHub:

```text
APP_URL=https://your-domain.example
CRON_SECRET=the-same-secret-used-in-vercel
```

The workflow in `.github/workflows/poll.yml` calls:

```text
GET /api/cron/poll-weather
```

with the `x-cron-secret` header.

Run it once from GitHub Actions after adding the secrets:

1. Open **Actions**.
2. Select **Poll Weather**.
3. Select **Run workflow**.
4. Confirm the run finishes successfully.

You can also smoke-test the deployed endpoint directly:

```bash
curl --fail --show-error --silent \
  -X GET "https://your-domain.example/api/cron/poll-weather" \
  -H "x-cron-secret: your-cron-secret"
```

## 5. Unsubscribe Flow

Set `NEXT_PUBLIC_APP_URL` in Vercel to the public production URL. Alert SMS messages use it to include:

```text
https://your-domain.example/unsubscribe
```

For one-way sender IDs, this public unsubscribe page is the primary opt-out path.

If you later use a two-way Arkesel sender, configure inbound STOP replies to call:

```text
https://your-domain.example/api/webhooks/arkesel?secret=YOUR_SECRET
```

## 6. Smoke Test

After deploying:

1. Subscribe with a real Ghana phone number.
2. Verify via SMS OTP.
3. Verify the USSD fallback guidance appears on `/verify`.
4. Open `/unsubscribe` and confirm the subscriber becomes inactive.
5. Manually trigger the GitHub Actions workflow.
