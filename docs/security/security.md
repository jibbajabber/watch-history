# Security Process

## Purpose

This document defines the standing security process for the repository.

Use it as the day-to-day playbook for keeping user-provided secrets private, whether they arrive through environment variables, config files, or server-side integration settings.

## Core Rule

An end user using the application must not be able to retrieve any secret.

That includes secrets exposed through:
- browser-visible props or DOM state
- DevTools or client-side network inspection
- API routes and server actions
- query strings and redirects
- logs, traces, or worker output
- build artifacts, bundles, or source maps

## What Counts As A Secret

Treat the following as secret-bearing unless a documented exception exists:
- environment variables:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL`
  - `HOME_ASSISTANT_ACCESS_TOKEN`
  - `PLEX_TOKEN`
- access tokens and bearer tokens
- database passwords
- API keys and client secrets
- webhook secrets
- private keys, signing keys, and certificate passphrases
- long-lived integration tokens such as Home Assistant or Plex credentials
- any derived credential-like value that would let someone impersonate the app or its integrations

These are the current sensitive environment variables in the repository's Compose setup.

## Development Flow

When changing code that touches secrets or external services:
1. Identify every secret-bearing environment variable or config field involved.
2. Confirm the value stays on the server side.
3. Confirm the browser cannot observe it through props, query strings, or API payloads.
4. Confirm logs and errors do not echo the value.
5. Confirm build artifacts and public assets do not contain it.
6. Add a regression test if a leak path is discovered and can be reproduced.

## Security Test Cadence

For security-sensitive changes, treat testing as part of implementation rather than only a close-out step.

During development:
- run a focused test whenever you change a secret-bearing route, server action, helper, or worker path
- re-run the relevant regression test after each fix to a leak path
- add or update the test before the change is considered complete when a leak path is reproducible

Before close-out:
- run `docker compose exec web npm run typecheck`
- run `docker compose exec web npm run test`
- run `docker compose exec web npm run build`
- verify the build output does not introduce source maps or browser-visible secret exposure
- confirm the browser-facing responses still contain only generic safe text

## Review Checklist

### Browser And API Surfaces

- No API route returns a secret-bearing value, even on failure.
- No server action places a secret into redirect query parameters.
- No client component receives a secret-bearing prop.
- No user-facing error includes a token, password, connection string, or upstream payload.

### Configuration

- Secret-bearing environment variables are only read in server-only code.
- Public or browser-visible config contains only non-secret values.
- YAML examples and README examples contain placeholders only.
- `NEXT_PUBLIC_*` is never used for secrets.

### Logging And Errors

- Logs use generic summaries, not raw credentials.
- Thrown errors are redacted before they reach a browser-visible response.
- Import jobs and background workers do not persist raw secret values in error fields.

### Build Output

- Client bundles do not contain secret-bearing values.
- Source maps, if present, are checked for accidental leakage.
- Public assets contain no credentials or operational tokens.

## Secure Coding Practices

- Prefer generic public messages and richer internal server logs.
- Sanitize upstream failures before converting them to browser-visible text.
- Keep secret-bearing values in server-only modules.
- Avoid forwarding raw exception text unless the message is proven non-sensitive.
- Prefer explicit allowlists for browser-facing fields over broad object spreading.

## Required Verification

For changes that touch secret-bearing data:
- follow the Security Test Cadence above
- add or update regression tests for any discovered leak path

For changes that alter browser-visible error handling or API output:
- inspect the response shape for secret-bearing fields
- inspect redirect query parameters for secret-bearing fields
- confirm the browser can only see generic safe text

## Security Close-Out Checklist

Use this at feature close-out or before merging a security-sensitive change:
- [ ] List every secret-bearing variable, field, or integration touched by the change.
- [ ] Confirm none of those values can reach browser state, API payloads, redirect URLs, or client logs.
- [ ] Confirm server-side logs and error text stay generic and do not echo raw credentials or upstream payloads.
- [ ] Confirm the browser-facing build output does not contain secret-bearing values or public source maps.
- [ ] Run the relevant focused regression test(s) during development.
- [ ] Run `docker compose exec web npm run typecheck`.
- [ ] Run `docker compose exec web npm run test`.
- [ ] Run `docker compose exec web npm run build`.
- [ ] Update `README.md`, `AGENTS.md`, or feature docs if the workflow or responsibility changed.

## Working With Environment Files

- Keep real values out of committed files.
- Do not read `.env` or similar secret-bearing files unless explicitly asked for that task.
- Document required variable names and expected formats instead of sample secrets.
- Prefer user-provided sanitized values or user-run commands when validating secret-backed behavior.

## Standing Reminder

If a user can retrieve a secret through the app, the browser, logs, or build output, the handling is not secure enough yet.
