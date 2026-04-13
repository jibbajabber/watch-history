# Feature 9: Plex Enrichment And Sources Polish

## Purpose

Improve the usefulness and presentation of Plex-derived timeline entries, and make the `/sources` screen more user-focused and visually consistent.

This feature should build on the completed Plex source support from feature 7 and the reliability work planned for feature 8.

## Product Goal

Make Plex entries more informative by surfacing richer playback context where it is reliable, and make the sources page feel cleaner, more consistent, and more relevant to the end user.

## Scope

Included:
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

Current `/sources` page content also has avoidable noise:
- descriptive text directly under the source title is not especially useful once the source exists and is configured
- the "Next step" block reflects internal project sequencing more than user-facing product value
- cards do not align especially well when one source has more content than another

## Design Direction

### Plex Enrichment

Prefer enrichment only when the source data is reliable enough to avoid misleading the user.

Candidate enrichments:
- playback device label
- partial-watch indicator
- watched duration or progress snippet
- better distinction between active playback, completed history, and partial playback

The first rule should be:
- do not show guessed progress or device context
- only render enriched metadata when the supporting Plex fields are present and trustworthy

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

- confirm which Plex fields are reliable enough for device labels
- confirm which Plex fields are reliable enough for partial-watch/duration display
- decide when enrichment should be omitted entirely

Exit criteria:
- the enrichment rules are explicit and defensible

### Phase 2: Plex Timeline Enrichment

- add device/progress metadata to normalized Plex events where safe
- update timeline rendering to show enriched Plex metadata cleanly
- ensure the UI distinguishes absent data from zero/empty values

Exit criteria:
- Plex entries are more informative without introducing guesswork

### Phase 3: Sources Screen Polish

- simplify source-card descriptive copy
- remove or replace internal-facing "Next step" sections
- align card layout structure and spacing across Home Assistant and Plex
- keep import and sync controls easy to scan

Exit criteria:
- the sources page reads as a polished user-facing control surface rather than an internal planning aid

## Acceptance Criteria

- Plex timeline entries can show device and/or partial-watch context when the source data is reliable enough
- the UI falls back cleanly when that enrichment data is unavailable
- source cards no longer emphasize internal project-planning language
- source-card layout is visibly more consistent across sources
- the `/sources` page remains clear and operationally useful

## Open Questions

- what exact Plex fields are reliable enough for partial-watch duration or progress display?
- should active-session Plex rows be visually distinct from durable history rows?
- should source cards show user-facing summaries like "last success" / "last failure" instead of the current "Next step" area?
- how far should alignment be pushed if the source cards have inherently different control sets?
