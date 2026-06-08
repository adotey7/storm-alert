# Security Policy

## Supported Versions

StormAlert GH is early-stage software. Security fixes target the latest `main` branch unless a release process is added later.

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities.

Report privately through GitHub private vulnerability reporting if it is enabled for the repository. If it is not enabled yet, contact the maintainers privately and include:

- Affected route, endpoint, or file
- Reproduction steps
- Impact
- Suggested fix, if known

## Sensitive Data

Never commit:

- `.env` files
- Neon connection strings
- Arkesel API keys
- Cron secrets
- OTP pepper values
- Real subscriber phone numbers

## Security Notes

- Route handlers that touch secrets or the database use the Node.js runtime.
- OTP verification should be tested with real provider behavior before launch.
- Cron requests must include `x-cron-secret`.
- One-way SMS senders should include the public `/unsubscribe` link in alerts.
- Arkesel webhook requests must include `ARKESEL_WEBHOOK_SECRET` in production when a two-way sender is available.
- OTP, verification, unsubscribe, and webhook endpoints are protected by database-backed rate limits.
