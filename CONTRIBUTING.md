# Contributing

Thanks for helping improve StormAlert GH.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env`.
3. Add local development credentials.
4. Run `pnpm prisma:generate`.
5. Run `pnpm dev`.

## Development Checks

Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

## Pull Requests

- Keep changes focused.
- Include tests for domain logic changes.
- Update docs when behavior, setup, or environment variables change.
- Do not commit `.env`, secrets, build output, or dependency folders.

## Commit Style

Use clear, imperative commit messages, for example:

```text
Add OTP USSD fallback guidance
Fix Ghana phone normalization
Document cron deployment secrets
```
