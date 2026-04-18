# Feature 9: Home Assistant Current-Playing Continuity

## Purpose

Improve Sky Q watch-history capture when Home Assistant continues reporting the same device/channel state across programme boundaries.

This feature should preserve a truthful history of what was watched over time, even when the box stays on the same channel for hours and the currently airing programme changes without a clear playback stop/start transition.

## Product Goal

Stop losing earlier programmes during long same-channel viewing sessions by making the Home Assistant import flow retain historical programme continuity instead of collapsing the timeline toward only the latest current-state details.

## Scope

Included:
- investigation of the current Home Assistant state-history and current-state merge behavior for Sky Q entities
- importer changes that preserve earlier programme entries when programme metadata changes while playback state remains active
- normalization rules for same-channel, same-device continuity when title/programme metadata advances
- idempotent rebuild behavior that does not erase already-captured programme history during later imports
- documentation of the source limitations and the rules used to infer programme boundaries

Excluded:
- Plex enrichment or `/sources` UI polish
- broad redesign of the shared timeline UI
- unsupported guesswork that invents programme boundaries without source evidence

## Problem Statement

The current Home Assistant importer rebuilds Sky Q `watch_events` from Home Assistant history plus a single appended current-state snapshot.

That works when Home Assistant emits meaningful state transitions, but it breaks down when:
- Sky Q remains in `playing`
- the user stays on the same channel
- the broadcast moves on to a new programme
- Home Assistant does not emit a durable history row for that programme change

In that case, the importer can end up reflecting only the latest currently airing programme details instead of preserving the sequence of programmes watched on that channel over time.

The result is a misleading timeline:
- earlier programmes may disappear or become under-represented
- long same-channel sessions lose detail
- repeated imports can rebuild history around the newest programme snapshot rather than the full watched sequence

Confirmed evidence from `docs/sources/skyq/same-channel-programme-change.md`:
- the persisted raw Home Assistant rows for `media_player.sky_q_bedroom` contain three distinct programmes in order: `The Big Bang Theory`, `Ffermio`, and `Gwladfa: Gwilym Bowen Rhys`
- the normalized `watch_events` for the same time window contain only `The Big Bang Theory`
- therefore the source data did not lose `Ffermio` or `Gwladfa`; the loss happened in the normalized rebuild path

## Current Implementation Context

Today the importer:
- fetches Home Assistant history from `/api/history/period/...`
- appends the current entity state when it is missing from the returned history
- normalizes sessions by grouping meaningful watch states across short resumable gaps
- replaces all Home Assistant-derived `watch_events` on each rebuild

This means current-state supplementation is useful for in-progress playback visibility, but it is not sufficient by itself to model programme changes that occur while the underlying entity state remains active.

It also means the importer currently trusts only the latest fetched response when rebuilding normalized events, even if `raw_import_records` already contain a more complete historical sequence from earlier imports.

## Design Direction

The first rule should be:
- preserve historical truth over simplicity

The importer should prefer evidence-backed continuity rules such as:
- treating a meaningful programme/title change during active playback as a new watched segment
- avoiding destructive replacement of earlier captured programme detail when the later import only has a fresher current snapshot
- preserving the raw source evidence needed to revisit matching rules later

Current leading implementation direction:
- treat persisted `raw_import_records` as the durable Home Assistant evidence set for normalization
- rebuild Home Assistant-derived `watch_events` from stored raw rows, rather than only from the most recent API response payload
- keep current-state supplementation only as a way to add new raw evidence, not as a reason to discard older normalized programme segments

Potential directions to validate:
- capture additional point-in-time current-state snapshots as raw records when they reveal a programme/title change not represented in the history API
- distinguish state transitions from programme transitions in normalization
- define safe heuristics for when a changed title on the same entity/channel starts a new watch segment
- decide whether normalization should rebuild from all persisted Home Assistant raw rows, or from a bounded but overlap-safe rolling window of those rows

## Implementation Plan

### Phase 1: Source-Behavior Validation

- inspect real Sky Q Home Assistant payloads across same-channel programme changes
- confirm which timestamps and attributes are stable enough to identify a programme boundary
- document when Home Assistant history does and does not emit attribute-only changes
- use the confirmed `Ffermio` -> `Gwladfa: Gwilym Bowen Rhys` sample as the baseline reproduction case

Exit criteria:
- the failure mode is evidenced with real source data and the importer rules are grounded in that behavior

### Phase 2: Importer Continuity Strategy

- update normalization so later imports do not erase programme rows that already exist in persisted Home Assistant raw data
- define whether the rebuild uses all stored raw rows or a bounded rolling window with explicit overlap rules
- update raw-record capture and/or current-state supplementation only where additional source evidence is still needed
- define how repeated imports preserve or rebuild same-channel programme segments idempotently
- ensure the importer treats meaningful title/programme changes as continuity boundaries even when `state` remains active

Exit criteria:
- repeated imports preserve a stable sequence of watched programmes for long same-channel sessions

### Phase 3: Timeline Validation

- verify that week, month, and year views reflect multiple programmes watched on the same channel over time
- confirm earlier programmes remain visible after later imports
- document any remaining source limitations clearly

Exit criteria:
- the timeline reflects the watched sequence more truthfully for long-running Sky Q sessions

## Acceptance Criteria

- long same-channel Sky Q viewing no longer collapses into only the latest programme shown on that channel
- repeated imports do not erase earlier watched programmes solely because the current snapshot has advanced
- if a programme already exists in persisted Home Assistant raw rows, later imports do not remove it from normalized history unless the source evidence is explicitly superseded by a better rule
- normalized watch history can represent multiple programme segments from the same entity/channel over time
- the implementation remains idempotent and compatible with the existing raw-import model
- documented limitations remain explicit where Home Assistant does not provide enough evidence for exact boundaries

## Open Questions

- which Home Assistant timestamp field is the most defensible anchor for programme-change snapshots when state does not change?
- should the importer persist explicit current-state snapshots as first-class raw records even when they are not part of the history API response?
- should Home Assistant normalization rebuild from all persisted raw rows every time, or from a bounded recent window with overlap protection?
- how should we represent uncertain end times for a programme when the next durable source event arrives late?
- what minimum evidence is required before splitting one active Sky Q session into two programme segments?
