# Feature 10: Plex Enrichment And Sources Polish

## Purpose

Improve the usefulness and presentation of Plex-derived timeline entries, and make the `/sources` screen more user-focused and visually consistent.

This feature should build on the completed Plex source support from feature 7, the reliability work completed in feature 8, and the completed Sky Q continuity work from feature 9.

## Product Goal

Make Plex entries more informative by surfacing richer playback context where it is reliable, ensure Plex timeline continuity is not vulnerable to the same latest-fetch rebuild gap that previously affected Home Assistant, and make the sources page feel cleaner, more consistent, and more relevant to the end user.

## Scope

Included:
- discovery of whether Plex watch-event rebuilding is vulnerable to incomplete latest-fetch responses or active-session gaps
- importer changes if needed so Plex normalization preserves already-captured raw history safely across repeated imports
- richer Plex timeline metadata when reliable device/progress data is available
- partial-watch presentation for Plex when the source data supports it safely
- clearer source cards that remove low-value explanatory copy
- removal or replacement of internal-facing "next step" messaging on `/sources`
- more consistent vertical alignment and layout across source cards

Excluded:
- speculative enrichment from unsupported Plex endpoints
- major timeline redesign outside the incremental enrichment of Plex rows
- backend reliability work that belongs in feature 8

## Problem Statement

Current Plex entries are usable but still relatively thin:
- they do not clearly communicate partial playback when that information is available
- they do not reliably show which playback device was used

Current Plex import behavior also still follows the older rebuild pattern:
- raw history rows and active-session rows are upserted into `raw_import_records`
- normalized `watch_events` are rebuilt from only the latest fetched Plex payload
- existing Plex `watch_events` are deleted and reinserted on each import
- current normalization in `lib/plex-import.ts` only carries device and progress-related fields on active session rows, not durable history rows

That means Plex may still have the same class of continuity risk that Home Assistant had before feature 9:
- a temporary incomplete history response could remove previously normalized rows
- provisional active-session rows may appear on one import and disappear on the next before durable history catches up
- the timeline can become dependent on the latest fetch rather than the fuller raw evidence already stored in the database

Current `/sources` page content also has avoidable noise:
- descriptive text directly under the source title is not especially useful once the source exists and is configured
- the "Next step" block reflects internal project sequencing more than user-facing product value
- cards do not align especially well when one source has more content than another
- the page already has useful health, sync, and import-state data, so feature 10 should emphasize those operational signals instead of adding more explanatory prose

## Design Direction

### Plex Continuity

Before leaning harder on enriched Plex metadata, confirm that the underlying rebuild model is trustworthy.

The first rule should be:
- do not let richer enrichment work obscure source-truth continuity
- if Plex is vulnerable to the same latest-fetch rebuild gap, fix that before relying more heavily on enriched Plex metadata in the UI

Continuity directions to validate:
- treat persisted Plex `raw_import_records` as the durable evidence set if the latest-fetch rebuild pattern proves lossy
- distinguish provisional active-session rows from durable history rows in normalization rules before exposing them more prominently in the UI
- keep repeated imports idempotent without making the latest fetch the sole source of truth

### Plex Enrichment

Prefer enrichment only when the source data is reliable enough to avoid misleading the user.

Candidate enrichments:
- playback device label
- partial-watch indicator
- watched duration or progress snippet
- better distinction between active playback, completed history, and partial playback

The rule for enrichment should be:
- do not show guessed progress or device context
- only render enriched metadata when the supporting Plex fields are present and trustworthy
- do not imply that durable Plex history rows contain progress detail when that data only exists on active-session-derived rows

### Sources Screen

The `/sources` page should feel like an operations dashboard for the user, not a project planning board.

Direction:
- reduce repetitive explanatory prose under each source title
- remove or replace "Next step" content with user-meaningful operational information
- keep cards aligned so buttons, sync controls, and status areas line up across sources where possible
- preserve clarity without over-densifying the screen

## Candidate UX Changes

### Source Card Header

Potential changes:
- keep source name, source type, and current status pill
- reduce or remove the long descriptive paragraph beneath the title
- replace it with concise, current-state information only if it adds user value

### Source Detail Body

Potential changes:
- replace "Next step" with health/freshness summaries or last-result summaries
- keep import button and sync controls prominent
- align card sections so the primary controls appear in the same visual bands across sources

### Plex Timeline Rows

Potential changes:
- show playback device when available
- show partial-watch status when the source data can support it honestly
- show watched duration/progress in the metadata row when meaningful
- visually distinguish provisional active-session entries from durable history if that distinction becomes user-visible

## Implementation Plan

### Phase 1: Data Validation

- confirm whether Plex normalization is vulnerable to the same latest-fetch clobbering pattern previously seen in Home Assistant
- inspect how `/status/sessions/history/all` and current sessions overlap across repeated imports
- confirm which Plex fields are reliable enough for device labels
- confirm which Plex fields are reliable enough for partial-watch/duration display
- decide when enrichment should be omitted entirely
- use the current repository state as the baseline:
  - `lib/plex-import.ts` currently deletes all Plex `watch_events` before reinserting from the latest fetched history and active sessions
  - `components/source-list-screen.tsx` currently retains a dedicated "Next step" section on every source card
  - `lib/sources.ts` already computes health, recovery, sync, and connection details that can replace most internal-facing guidance

Exit criteria:
- the continuity risk is understood and the enrichment rules are explicit and defensible

### Phase 2: Plex Continuity Strategy

- decide whether Plex watch-event rebuilding should use persisted raw rows instead of only the latest fetched payload
- preserve or clearly model provisional active-session rows so repeated imports do not remove meaningful recent playback unexpectedly
- keep repeated Plex imports idempotent while avoiding destructive loss of already-captured timeline history

Exit criteria:
- Plex repeated imports preserve expected timeline continuity even when active-session and durable-history timing differs

### Phase 3: Plex Timeline Enrichment

- add device/progress metadata to normalized Plex events where safe
- update timeline rendering to show enriched Plex metadata cleanly
- ensure the UI distinguishes absent data from zero/empty values
- keep durable-history Plex rows visually conservative unless equivalent metadata exists in persisted raw history

Exit criteria:
- Plex entries are more informative without introducing guesswork

### Phase 4: Sources Screen Polish

- simplify source-card descriptive copy
- remove or replace internal-facing "Next step" sections
- align card layout structure and spacing across Home Assistant and Plex
- keep import and sync controls easy to scan

Exit criteria:
- the sources page reads as a polished user-facing control surface rather than an internal planning aid

## Acceptance Criteria

- repeated Plex imports do not remove already-captured timeline rows solely because the latest fetch is temporarily less complete
- any provisional active-session behavior is either preserved safely or clearly constrained so it does not mislead the user
- Plex timeline entries can show device and/or partial-watch context when the source data is reliable enough
- Plex history rows do not pretend to have device/progress detail when only provisional session rows carry it
- the UI falls back cleanly when that enrichment data is unavailable
- source cards no longer emphasize internal project-planning language
- source-card layout is visibly more consistent across sources
- the `/sources` page remains clear and operationally useful

## Open Questions

- should Plex normalization rebuild from persisted raw rows every time, as Home Assistant now does, or is the latest-fetch model sufficient for Plex durability?
- how should provisional active-session rows behave when a later import still does not have the matching durable history row yet?
- what exact Plex fields are reliable enough for partial-watch duration or progress display?
- should active-session Plex rows be visually distinct from durable history rows?
- should source cards show user-facing summaries like "last success" / "last failure" instead of the current "Next step" area?
- how far should alignment be pushed if the source cards have inherently different control sets?

## Review Notes

Repository review on 2026-04-18 confirms:
- feature 10 still needs implementation; the current draft matches the broad intent but needed tighter grounding in the actual code paths
- Plex continuity is a real implementation concern, not just a hypothetical one, because `runPlexImport()` currently rebuilds from only the latest fetched payload
- Plex enrichment should likely be asymmetric unless further evidence appears, because active sessions currently expose richer device/progress fields than durable history rows
- `/sources` polish should reuse the existing health and sync data model instead of inventing a new status framework
