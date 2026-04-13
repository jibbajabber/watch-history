# Feature 8: Import Reliability And Source Health

## Purpose

Make manual and scheduled imports resilient when a source is temporarily unavailable, misconfigured, slow, or intermittently failing.

This feature should improve operational reliability without disrupting the rest of the application when an import fails.

## Product Goal

Allow Watch History to continue functioning normally when one or more sources cannot be contacted, while clearly surfacing source-health problems and automatically retrying on the next scheduled interval.

## Scope

Included:
- resilient manual import behavior when a source is unreachable or returns errors
- resilient scheduled import behavior when a source is unreachable or returns errors
- clear source-health status updates after failures
- non-blocking failure visibility in the main application UI
- retry-on-next-interval behavior without crashing the app or worker

Excluded:
- broad distributed job orchestration
- aggressive retry storms or exponential backoff systems beyond the current single-worker deployment
- deep device/progress enrichment work for Plex

## Design Direction

Prefer simple operational resilience over elaborate background infrastructure.

The current Docker-managed worker and manual import actions should remain the execution model. Reliability should come from:
- accurate import-job failure recording
- source status derived from both connectivity checks and recent import failures
- graceful UI messaging when source freshness or health is degraded
- source-specific retry on the next normal scheduled tick instead of blocking the app

## Reliability Goals

- a failed import must not crash the application shell or timeline pages
- a failed scheduled import must not stop later scheduled ticks for the same or other sources
- a failed manual import must surface a useful error without corrupting normalized data
- source status should show when a source is healthy, degraded, or recently failing
- timeline pages should remain usable even when imports are temporarily stale

## Candidate Failure Cases

- source host unreachable
- DNS failure
- bad or expired token
- upstream API error
- temporary timeout
- source returns incomplete or malformed payloads
- scheduled sync worker cannot complete one source import while other sources remain healthy

## UX Direction

### Source Status

The `/sources` page should reflect not only connectivity but also recent import health.

Potential indicators:
- last successful import
- last failed import
- current sync enabled/disabled state
- recent failure reason in concise form

### Timeline Banner

The main timeline pages should gain a small shared informational banner when source health is degraded.

Placement direction:
- use the top-right support area in the shared shell header, where there is currently empty space beside the hero copy and section card
- the banner should be compact, visible, and non-blocking
- the banner should summarize the issue and point users to `/sources` for details

Example behaviors:
- show nothing when all enabled sources are healthy
- show a warning banner when at least one source has recent failures or stale imports
- avoid modal or blocking interruption of timeline browsing

## Implementation Plan

### Phase 1: Failure State Model

- define what counts as healthy, degraded, and blocked per source
- decide how recent import failures should affect visible source status
- expose enough recent import information to drive health UI

Exit criteria:
- the application can distinguish connectivity readiness from recent import reliability

### Phase 2: Worker And Manual Import Resilience

- ensure scheduled failures remain isolated to the failing source
- ensure the worker continues ticking other sources after one source fails
- ensure failed manual imports do not wipe or corrupt previously normalized data

Exit criteria:
- the app and worker remain stable through repeated source failures

### Phase 3: Health Visibility

- add degraded/failed source health indicators to `/sources`
- add a shared non-blocking info banner to timeline pages
- surface concise failure summaries and next steps

Exit criteria:
- users can tell when imports are stale or failing without hunting through logs

## Acceptance Criteria

- manual imports fail safely and report useful errors
- scheduled imports fail safely and continue trying again on later intervals
- one failing source does not prevent the app or other scheduled sources from continuing to work
- source status reflects recent failure health, not just connectivity readiness
- timeline pages remain usable and can show a compact warning banner when relevant

## Current Implementation Status

Implemented so far:
- failed manual imports now return to `/sources` with a non-blocking error banner instead of surfacing a server-action stack trace
- recent failed imports and stale scheduled sources now feed source health status
- the shared app shell can show a compact `Source Health` banner on the main timeline pages when an active source needs attention

Still to finish before feature 8 is complete:
- verify and, if needed, harden scheduled-import failure behavior end to end so one failing source never disrupts later worker ticks
- refine stale/failure visibility on `/sources` so the most useful reliability details are obvious without reading low-value implementation copy
- confirm the recovery path is clear when a source comes back, including how quickly health returns from `Failing` or `Stale` to normal

## Open Questions

- how long should a failed source remain visually degraded before the UI returns to normal after recovery?
- should stale-but-not-failing sources use a different status from actively failing sources?
- should the banner appear for all failures, or only for enabled sources that are currently expected to sync?
- what exact threshold should define “stale” per source relative to its configured schedule?
