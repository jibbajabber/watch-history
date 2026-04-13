# Feature 3: Home Assistant Sky Q History Ingestion

## Purpose

Add Sky Q watch-history ingestion via Home Assistant after Home Assistant authentication has been established.

This feature depends on feature 2. It should use Home Assistant as the source system for watch-related activity from the Sky Q devices in the living room and bedroom.

## Product Goal

Allow the application to ingest watch-related activity from these Home Assistant entities and normalize it into canonical watch events:
- `media_player.sky_q_livingroom`
- `media_player.sky_q_bedroom`

## Position In Delivery Sequence

- feature 1 creates the application shell and timeline views
- feature 2 authenticates to Home Assistant and validates source connectivity
- feature 3 pulls entity history for the Sky Q media players and normalizes it into watch events

## Scope

Included later:
- source-specific ingestion for `media_player.sky_q_livingroom`
- source-specific ingestion for `media_player.sky_q_bedroom`
- Home Assistant history API access for those entities
- raw record storage
- normalization into `WatchEvent`

Deferred for now:
- broader Home Assistant entity support
- background sync strategy beyond the first manual or scheduled import path
- any general-purpose Home Assistant connector beyond what Sky Q needs first

## Planning Direction

The Sky Q ingestion flow should reuse the same high-level import structure:
- source definition
- import job tracking
- raw source record preservation
- normalization into canonical watch events

Expected data source:
- Home Assistant history/state data for the two Sky Q media-player entities

Likely useful inputs:
- media-player state transitions
- title/program attributes exposed by the Sky Q entities
- playback start/stop timing
- room/device context from the entity identity

## Preconditions

Do not start this feature until:
- feature 1 is complete enough to render imported events cleanly
- feature 2 has established authenticated Home Assistant access
- the canonical event model is stable enough to support source-specific normalization

## Acceptance Criteria

- the application can query history for `media_player.sky_q_livingroom` and `media_player.sky_q_bedroom`
- imported Home Assistant records are preserved as raw source data
- normalized Sky Q activity appears in the same timeline model as other sources
- source-specific quirks do not leak into the shared UI model unnecessarily

## Open Questions

- what attributes do the two Sky Q media-player entities expose during playback that are good enough to identify a watched item?
- should the first import use the history API, logbook API, or both?
- how should noisy state transitions such as `idle`, `off`, or channel hopping be filtered into meaningful watch events?
- what rules define a single watch event versus multiple short events?
