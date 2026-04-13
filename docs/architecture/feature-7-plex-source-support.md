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
- scheduled Plex sync inside the Docker-managed environment

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

## Initial Discovery Findings

Current documentation review suggests:
- the first Plex integration should be API-based rather than file-based
- the first authentication model should use a server-side `X-Plex-Token`
- the token should be supplied through the Docker Compose env file
- the likely core configuration surface is `PLEX_BASE_URL` plus `PLEX_TOKEN`
- the first raw import path should likely use the Plex Media Server history endpoint at `/status/sessions/history/all`

Official Plex docs indicate that:
- Plex Media Server endpoints expect token-based authentication using the `X-Plex-Token` header
- tokens are obtained from plex.tv / Plex Web App flows
- Plex exposes server history endpoints with fields including `historyKey`, `key`, `ratingKey`, `librarySectionID`, `title`, `type`, `viewedAt`, `accountID`, and `deviceID`
- Plex distinguishes between watch state and watch history; the history log is the correct source for this product's timeline model

Captured sample data in `docs/sources/plex/history-all.md` confirms that `/status/sessions/history/all` returns enough information for a first import flow, including:
- `historyKey` for stable history-row identity
- `ratingKey` and `key` for media identity
- `type` for media classification
- `viewedAt` for watch timestamp
- episode hierarchy fields such as `parentKey`, `grandparentKey`, `grandparentTitle`, `index`, and `parentIndex`
- `accountID` for user/account filtering

The current sample does not show:
- playback device labels
- `deviceID`
- progress offsets or duration fields
- explicit partial-watch markers

This is enough to proceed with a token-based connection model and history-endpoint import strategy for v1. The practical implication is that the first Plex normalization pass should treat history rows as completed watch events unless a later supported endpoint adds reliable progress semantics.

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

Current direction:
- use `PLEX_BASE_URL` for the target Plex Media Server URL
- use `PLEX_TOKEN` for server-side API authentication
- target a personal/local Plex server first rather than broader hosted account flows
- store non-secret Plex sync scheduling in `configs/plex.yaml`

Exit criteria:
- the application can determine whether Plex is configured correctly
- the application can report whether the Plex source is reachable and ready

### Phase 2: Raw Import

- choose the first real Plex activity endpoint or export path
- import real Plex watch activity into `raw_import_records`
- record import jobs and failure states for Plex

Current direction:
- use `/status/sessions/history/all` as the first raw history source
- supplement it with `/status/sessions` when active playback is present but history has not yet been written
- preserve the raw history payload exactly before applying normalization rules
- retain `accountID` in metadata for single-user filtering
- treat device context as optional or deferred unless later payload discovery exposes it reliably

Known limitation:
- Plex does not document an exact handoff time for when a stopped playback leaves `/status/sessions` and appears in `/status/sessions/history/all`
- this means there can be a short gap where a just-stopped item is no longer an active session but has not yet been written into durable playback history
- the v1 import path should treat that as expected Plex source behavior rather than as a timezone bug in Watch History

Exit criteria:
- the application can preserve raw Plex activity records repeatably
- repeated imports avoid uncontrolled duplication at the raw-source layer where possible

### Phase 3: Normalization

- define how Plex watch activity maps into `watch_events`
- normalize titles, media type, watched timestamps, and duration/progress fields
- decide how Plex-specific fields should be retained in `metadata`

Current open normalization questions:
- whether a history row should map directly to a `WatchEvent`, or whether some rows need grouping or filtering
- whether any additional supported Plex endpoint is needed later to enrich v1 history rows with progress or device metadata
- whether rewatches require any extra handling beyond multiple history rows for the same `ratingKey`

Current direction:
- map one Plex history row to one normalized `WatchEvent`
- treat `viewedAt` as the canonical watch timestamp
- treat the chosen history endpoint as completed-watch history for v1
- allow active sessions from `/status/sessions` to appear as provisional current-playback events when durable history has not yet landed
- preserve the raw payload so later progress/device enrichment can be layered on without losing source fidelity

Exit criteria:
- normalized Plex activity appears in the shared timeline views
- repeated imports remain idempotent at the normalized watch-event layer

## Acceptance Criteria

- Plex appears as a first-class source in the product
- the application can authenticate to Plex using the documented container-first workflow
- raw Plex activity records are preserved before normalization
- normalized Plex watch activity appears in the week, month, and year timeline views
- repeated Plex imports behave idempotently
- Plex can also run on a schedule inside Docker Compose without conflicting with manual imports

## Risks

- Plex authentication and activity APIs may expose different shapes depending on server version or deployment mode
- a file-based export path may be simpler operationally but weaker as a long-term sync model
- Plex watch progress semantics may not map cleanly to the current watch-event assumptions
- multi-user Plex servers may introduce ambiguity even if v1 remains single-user focused

## Open Questions

- should the first Plex implementation target a personal Plex server only, or also hosted Plex account flows?
  - target local server
- is the initial import path better served by the Plex API, database export, or another supported mechanism?
  - current discovery points to the Plex Media Server API, specifically `/status/sessions/history/all`
- what counts as a complete watched event for Plex content with partial progress?
  - for v1, the chosen history endpoint should be treated as completed-watch history unless later supported discovery proves otherwise
- do we need to distinguish between app/device playback context and the content itself in the normalized metadata?
  - it would be nice to know which device the content was being watched from, but current sampled history rows do not expose that yet and it should not block v1

## Official Reference Notes

- Plex token auth support and token retrieval guidance:
  - https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
- Plex Media Server URL command guidance:
  - https://support.plex.tv/articles/201638786-plex-media-server-url-commands/
- Plex Media Server API reference, including `/status/sessions/history/all`:
  - https://developer.plex.tv/pms/
- Plex support distinction between watch state and watch history:
  - https://support.plex.tv/articles/sync-watch-state-and-ratings/
