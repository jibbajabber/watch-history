# Feature 15: Security Review And Secret-Exposure Hardening

## Purpose

Audit the application for any path that could expose secrets, credentials, tokens, or other sensitive configuration to the browser, API consumers, logs, generated bundles, or other untrusted end-user access.

This feature is a review-first hardening pass. It should identify and close secret-leakage risks before they become trusted product behavior.

## Product Goal

Make sure the application keeps secrets server-side only and does not reveal them through:
- browser-visible UI state
- API responses
- server actions
- client bundles or inline scripts
- debug output, stack traces, or error messages
- source maps, logs, or other generated artifacts that an end user could retrieve

For this feature, "secrets" includes any user-provided or environment-provided value that would let the app talk to an external system or internal service, such as:
- access tokens and bearer tokens
- database URLs and database passwords
- API keys and client secrets
- webhook secrets
- private keys, signing keys, and certificate passphrases
- long-lived integration tokens such as Home Assistant or Plex credentials
- any derived credential-like string that would let an end user impersonate the app or its integrations

## Scope

Included:
- review all API routes, server actions, and data-loading paths for accidental secret disclosure
- review environment-variable handling to confirm only non-secret values are exposed to client code
- review error handling so internal exceptions do not leak tokens, passwords, connection strings, or raw upstream payloads
- review import and connectivity helpers for accidental logging of credentials or full upstream responses
- review config loaders and writers so secret-bearing values stay server-only
- review build and deployment outputs for secret exposure risks that could be fetched from the browser
- add focused regression tests or assertions for any leak paths that are discovered and fixed
- document any remaining hardening assumptions or unresolved risks in the repository docs

Excluded:
- broad authentication redesign unless the review uncovers a concrete need
- product-level permission systems beyond the current single-user scope
- full penetration testing or external security certification
- infrastructure hardening outside the repository unless it directly affects the app's secret exposure

## Problem Statement

The current app relies on environment variables and server-side integrations for:
- database access
- Home Assistant authentication
- Plex authentication
- internal app-to-worker calls

Those values are secret even when they are supplied through environment variables rather than hardcoded source files. If a user can retrieve them through a browser debugger, a network response, an API route, a server action, a log line, a stack trace, or a public build artifact, they are no longer secret.

That is correct architecture only if those values stay server-side. The main risk areas are:
- API or route handlers returning `error.message` values that may include internal details
- client bundles accidentally receiving `process.env` values or server-only config
- server actions or screen props serializing secrets into browser-visible responses
- logs, debug traces, or proxy errors revealing token values or upstream payloads
- build-time artifacts or source maps exposing details that should remain private

Representative exposure paths to keep in scope:
- browser DevTools showing serialized props, query strings, or client-side runtime data
- `fetch` responses from exposed routes such as `/api/*`
- server actions that redirect with sensitive detail in the URL
- worker or container logs that print raw tokens, URLs, or upstream payloads
- debug output, stack traces, and thrown errors that include the original credential value
- static assets, build output, or source maps that contain private config values

Feature 15 exists to make those risks explicit and remove them where possible.
The standing security-process guide for ongoing work lives in [docs/security/security.md](/home/ads/git/watch-history/docs/security/security.md).

## Review Direction

### Server And Browser Boundary

Inspect the Next.js app for places where server-only data might cross into client-visible state:
- route handlers under `app/api/`
- server actions under `app/sources/actions.ts`
- page and layout data flow in `app/`
- client components under `components/`

Pay particular attention to any JSON responses or redirect query parameters that may include:
- raw exception messages
- upstream response payloads
- configuration values
- connection strings
- access tokens

Concrete review targets in this repository:
- `app/api/curation/route.ts`
- `app/api/timeline/[view]/route.ts`
- `app/api/sources/route.ts`
- `app/api/health/route.ts`
- `app/sources/actions.ts`
- `components/timeline/event-card.tsx`

Checklist:
- no route handler returns raw secret-bearing values in success or error payloads
- no server action serializes secret-bearing values into redirect query strings
- no client component can receive `process.env` values or server-only config through props
- no user-facing error message echoes a token, password, connection string, or upstream payload
- no browser-visible state includes internal debug details that would help infer secrets

### Environment And Config Handling

Review the config loaders and helpers that read environment variables or YAML-backed settings:
- `lib/app-config.ts`
- `lib/db.ts`
- `lib/home-assistant.ts`
- `lib/home-assistant-config.ts`
- `lib/home-assistant-import.ts`
- `lib/plex.ts`
- `lib/plex-config.ts`
- `lib/plex-import.ts`
- `scripts/source-sync-worker.ts`

The goal is to confirm:
- secret values are only read in server-side code
- non-secret config can be surfaced where needed
- secret-bearing fields are never returned to the browser or written into public assets

Checklist:
- only server-only files read secret-bearing environment variables
- any config or status object returned to the browser omits secrets by construction
- `NEXT_PUBLIC_*` is not used for anything that should remain private
- config writers never persist credentials into repo-tracked YAML or example files
- worker scripts do not print or re-emit secrets in error or progress output

### Error And Log Hygiene

Review how errors are converted into user-facing messages:
- API error responses
- redirect query parameters from server actions
- any console logging or worker output

The desired behavior is:
- user-facing messages stay generic and actionable
- internal diagnostics stay server-side
- sensitive values are redacted rather than echoed

Checklist:
- `error.message` is never forwarded to the browser when it might contain sensitive details
- upstream API failures are mapped to safe, source-specific messages
- redirect query parameters contain only non-sensitive status text
- stack traces and transport errors stay in logs, not in HTTP responses
- log output redacts tokens, URLs with credentials, and raw upstream payloads

### Build Artifact Review

Review the build and runtime outputs for any accidental secret leakage:
- client bundle inclusion
- generated source maps
- static files and public assets
- README or example files that might accidentally document real credentials

Checklist:
- no client bundle contains secret-bearing environment values
- generated source maps do not expose private values beyond normal code structure
- public assets and example files contain only placeholders
- repository docs describe required variables without real credentials or sample secrets

## Audit Plan

### Phase 1: Surface Inventory

- map every browser-visible entrypoint and server-only helper that touches configuration or external services
- classify each environment variable as secret, operational, or public
- note every response path that can send data back to the browser

Exit criteria:
- the review has a complete surface inventory and a list of secret-bearing variables

### Phase 2: Boundary Review

- inspect API routes, server actions, and client components for accidental secret serialization
- verify that browser-facing props and JSON payloads exclude secret-bearing fields
- check redirect flows for query-string leakage

Exit criteria:
- every browser-visible path has an explicit yes/no secret-leak assessment

### Phase 3: Error And Log Review

- review connectivity helpers, import paths, and route handlers for safe error shaping
- verify that user-facing messages are generic while internal logs stay diagnostic
- add or update tests for any discovered leak or redaction rule

Exit criteria:
- error handling has a documented redaction strategy and regression coverage where needed

### Phase 4: Build Artifact Review

- inspect build outputs and static/public assets for accidental secret exposure
- confirm source maps and generated bundles do not contain private configuration values
- check example files and README text for placeholder-only secret documentation

Exit criteria:
- the build output story is documented and no obvious secret leakage remains

### Phase 5: Findings And Remediation

- record each finding with file path, leak mechanism, and remediation
- apply the minimum safe fix that keeps the secret server-side
- add focused tests for the fix when the regression is reproducible in the current test stack

Exit criteria:
- findings are either fixed or explicitly marked as accepted risks with rationale

## Acceptance Criteria

- the repository has a documented security-review scope and checklist
- secret-bearing values are confirmed to remain server-side
- browser-visible responses do not expose tokens, passwords, database URLs, or upstream credentials
- error paths do not leak sensitive internals to end users
- any discovered leak paths are fixed and covered by regression tests where practical
- unresolved risks are documented explicitly rather than ignored

## Implementation Status

Current state as of Monday, 20 April 2026:
- feature direction changed from CI/GitHub Actions to secret-exposure security review
- the review has now identified and remediated browser-facing raw error forwarding in API routes, server actions, connectivity helpers, and persisted import-failure text
- regression coverage exists in `tests/connectivity-safety.test.ts`, `tests/source-status.test.ts`, and `tests/sources.test.ts`
- production build output was checked and no standalone source-map files were emitted
- sensitive env-var references were found in server-only chunks, but not in browser-facing static assets
- source-map and build-artifact review is otherwise complete for the current repo state unless a concrete source-map setting appears later

## Open Questions

- Should the audit produce a short findings log in `docs/architecture/` or remain as notes in this spec until a remediation lands?

## Sensitivity Examples

Treat the following as secret-bearing unless there is a strong reason documented otherwise:
- `POSTGRES_USER`
- `HOME_ASSISTANT_ACCESS_TOKEN`
- `PLEX_TOKEN`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- any future API token, OAuth secret, or long-lived session token supplied through env vars
- any password, private key, or signing secret supplied through env vars

These are the current sensitive environment variables in the repository's Compose setup.

These values must not be:
- written to browser-visible props or query parameters
- echoed in `console.log`, worker output, or exception text
- returned from API routes or server actions
- embedded in static assets, source maps, or generated bundles
- derivable by an end user through normal use of the application
