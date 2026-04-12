# Feature 5: Scheduled Home Assistant Sync

## Purpose

Move the Home Assistant import flow from a manual button-driven workflow to a scheduled or background sync model.

This feature should build on the verified manual import path and reuse the existing idempotent import behavior.

## Product Goal

Keep Watch History current automatically by syncing Home Assistant Sky Q history on a regular schedule without requiring the user to trigger imports manually.

## Scope

Included:
- background or scheduled import execution
- container-friendly scheduling approach
- import status visibility for automated runs
- failure reporting for scheduled syncs
- idempotent re-import behavior for repeated sync runs

Excluded:
- unrelated source integrations
- multi-user scheduling complexity
- speculative distributed job infrastructure beyond what the single-user Docker deployment needs

## Design Direction

Prefer the simplest scheduling model that fits the current deployment shape.

Likely options:
- a lightweight worker service in `docker compose`
- an in-app scheduled task if the runtime model supports it cleanly
- a cron-like container that invokes the existing import path

The chosen approach should:
- keep secrets inside the container environment
- work reliably in the current Docker Compose setup
- not require host-local cron jobs as the primary workflow

## Implementation Plan

### Phase 1: Scheduling Strategy

- choose the scheduling model for the current stack
- define how often Home Assistant sync should run
- define how manual and automatic imports interact

### Phase 2: Execution

- implement scheduled invocation of the Home Assistant import flow
- preserve the existing idempotent import behavior
- ensure overlapping syncs do not race or corrupt the normalized timeline layer

### Phase 3: Visibility And Recovery

- record scheduled import runs in `import_jobs`
- show last successful sync and last failed sync in the UI
- surface useful failure details so the user can recover from bad tokens, network failures, or Home Assistant outages

## Acceptance Criteria

- Home Assistant imports can run on a schedule inside the Docker-managed environment
- repeated syncs remain idempotent
- scheduled sync failures are visible and diagnosable
- manual imports still work and do not conflict with scheduled runs

## Open Questions

- how often should automatic sync run for a personal Home Assistant deployment?
- do we need import locking to prevent overlapping runs?
- should scheduled sync be configurable through YAML, env vars, or both?
