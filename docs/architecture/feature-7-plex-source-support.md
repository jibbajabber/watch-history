# Feature 7: Plex Source Support

## Purpose

Add Plex as the next watch-history source after Home Assistant so the application can ingest media activity beyond Sky Q.

This feature should establish the first Plex integration path in a way that fits the current single-user, Docker-hosted deployment model.

## Product Goal

Allow the application to connect to Plex, import real watch-history activity, preserve the raw Plex records, and normalize those records into the shared timeline model used by the existing views.

## Scope

Included:
- the first supported Plex authentication/configuration model
- source registration and readiness reporting for Plex
- raw Plex activity import and storage
- normalization of Plex activity into `watch_events`
- idempotent repeat imports

Excluded:
- speculative multi-user Plex account management
- broad metadata enrichment beyond what Plex already provides
- unrelated UI redesigns beyond what the shared timeline model requires

## Constraints

- all tooling and runtime behavior must stay inside the Docker-managed environment
- Plex credentials or tokens must come from env vars supplied to `docker compose`
- the application should continue to use live imported data rather than mocked data
- raw Plex records must be preserved before normalization
- the first implementation should prefer the simplest durable import path over a more ambitious sync platform

## Discovery Questions

- what is the most reliable first Plex integration path: API-based, file-based export, or both?
- what Plex credential model best fits the current single-user deployment?
- which Plex activity fields are stable enough to identify watched items, timestamps, users, and durations?
- how should Plex movies, episodes, and partial progress map into the existing watch-event model?
- how should Plex rewatches and resumed sessions be represented?

## Design Direction

Prefer a pragmatic first integration:
- use a server-side Plex connection model that works cleanly in Docker Compose
- preserve raw Plex activity records in the same source-first pattern used for Home Assistant
- normalize Plex activity into the shared timeline without leaking Plex-specific quirks into the UI model unnecessarily
- keep the first scope narrow enough to validate the ingestion approach before adding advanced enrichment or library browsing

## Recommended Delivery Plan

### Phase 1: Connection Model

- choose the first Plex authentication/configuration approach
- document the required env vars and any non-secret configuration
- add Plex as a first-class source in the source status flow

Exit criteria:
- the application can determine whether Plex is configured correctly
- the application can report whether the Plex source is reachable and ready

### Phase 2: Raw Import

- choose the first real Plex activity endpoint or export path
- import real Plex watch activity into `raw_import_records`
- record import jobs and failure states for Plex

Exit criteria:
- the application can preserve raw Plex activity records repeatably
- repeated imports avoid uncontrolled duplication at the raw-source layer where possible

### Phase 3: Normalization

- define how Plex watch activity maps into `watch_events`
- normalize titles, media type, watched timestamps, and duration/progress fields
- decide how Plex-specific fields should be retained in `metadata`

Exit criteria:
- normalized Plex activity appears in the shared timeline views
- repeated imports remain idempotent at the normalized watch-event layer

## Acceptance Criteria

- Plex appears as a first-class source in the product
- the application can authenticate to Plex using the documented container-first workflow
- raw Plex activity records are preserved before normalization
- normalized Plex watch activity appears in the week, month, and year timeline views
- repeated Plex imports behave idempotently

## Risks

- Plex authentication and activity APIs may expose different shapes depending on server version or deployment mode
- a file-based export path may be simpler operationally but weaker as a long-term sync model
- Plex watch progress semantics may not map cleanly to the current watch-event assumptions
- multi-user Plex servers may introduce ambiguity even if v1 remains single-user focused

## Open Questions

- should the first Plex implementation target a personal Plex server only, or also hosted Plex account flows?
- is the initial import path better served by the Plex API, database export, or another supported mechanism?
- what counts as a complete watched event for Plex content with partial progress?
- do we need to distinguish between app/device playback context and the content itself in the normalized metadata?
