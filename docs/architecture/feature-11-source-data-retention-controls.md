# Feature 11: Source Data Retention Controls

## Purpose

Give the user explicit control over how long source data is retained, per source, across both raw imported records and normalized watch history.

This feature should build on the completed Home Assistant and Plex continuity work. It should not weaken source-truth behavior, but it should make retention a deliberate product setting instead of an accidental side effect of current import logic.

## Product Goal

Let the user decide whether each source keeps data indefinitely or purges data older than a configured retention window, while keeping the purge model understandable, auditable, and source-specific.

## Scope

Included:
- discovery of all currently retained source data surfaces, including `raw_import_records`, `watch_events`, and any source-specific provisional rows
- per-source retention settings that can be configured through the product rather than hardcoded in import logic
- support for an "indefinite retention" mode
- support for time-based retention windows, likely expressed in days or hours depending on the source concern
- source-specific handling for provisional or pending rows such as Plex sessions that have not yet become durable history
- scheduled cleanup behavior that runs inside the existing Docker-managed environment
- UI on `/sources` or a clearly related source-management surface for viewing and editing retention settings
- documentation of exactly what data is purged when a retention rule is applied

Excluded:
- analytics and reporting visualizations about data growth over time
- cross-source global retention that overrides all source-specific settings by default
- speculative deletion of metadata that belongs to unrelated future entities

## Problem Statement

The application currently preserves imported source data aggressively, which is correct for continuity, but it leaves retention behavior undefined:
- some sources now intentionally rebuild normalized history from persisted raw rows
- Plex provisional rows are now preserved until durable history replaces them
- there is no explicit user-facing retention model for raw records or normalized watch events
- there is no product-level answer yet to "how much source data should be kept, and for how long?"

That creates three product gaps:
- storage growth is not yet user-controlled
- source-specific behaviors like provisional Plex session retention are not configurable
- the system currently depends on implementation details rather than documented retention policy

## Design Direction

### Retention As A Source Setting

Retention should be owned by each source.

Why:
- source semantics differ
- raw records have different value across sources
- provisional behaviors such as Plex pending-history rows are source-specific

Expected model:
- each source can keep data indefinitely
- each source can opt into retention cleanup
- each source can define a retention duration appropriate to that source

### Retention Surfaces

The feature should explicitly decide which data categories can be purged:
- raw import records
- normalized watch events
- source-specific provisional rows
- import-job audit records if they become relevant to retention policy

The policy should be transparent:
- if old raw records are purged, the user should understand that old normalized history may also disappear or become non-rebuildable
- if normalized watch events are retained longer than raw rows, that should be a conscious policy choice, not an accident

### Retention Units

Not every retention control needs the same unit:
- long-term history retention likely belongs in days
- provisional row cleanup may reasonably use hours

Feature 11 should decide whether to expose:
- one general source retention window
- plus optional source-specific sub-settings where needed

## Candidate UX Changes

### Source Retention Block

Potential additions to each source card:
- `Retention` status summary
- `Keep indefinitely` toggle
- retention duration input when cleanup is enabled
- source-specific explanatory copy that states what will be deleted

### Retention Warnings

Potential UX safeguards:
- warn before shrinking a retention window below currently stored data age
- explain whether cleanup affects raw records, normalized history, or both
- clarify that retention changes apply going forward and may trigger future cleanup jobs

## Implementation Plan

### Phase 1: Discovery

- inventory what data each source currently stores
- decide what should be retained indefinitely by default
- decide what data categories are safe to purge
- define whether provisional Plex retention is part of the general source retention setting or an additional source-specific option

Exit criteria:
- the repository has a documented retention model for Home Assistant and Plex

### Phase 2: Configuration Model

- define non-secret per-source retention settings in source config or database-backed source settings
- support `indefinite` retention explicitly
- support time-based retention for enabled cleanup

Exit criteria:
- the product has a clear source-retention configuration shape

### Phase 3: Cleanup Execution

- implement cleanup inside the Docker-managed worker model
- ensure cleanup is idempotent and safe
- ensure cleanup does not race with imports

Exit criteria:
- cleanup can run automatically without corrupting source continuity

### Phase 4: Source UI

- expose retention state and controls to the user
- explain what the setting affects
- preserve a clear operational view on `/sources`

Exit criteria:
- the user can inspect and change source retention settings without editing files manually

## Acceptance Criteria

- each source has an explicit retention policy, including an indefinite mode
- the user can control source retention without editing code
- retention behavior is documented in plain language
- cleanup runs inside the existing Docker-managed environment
- cleanup does not break source-specific continuity guarantees
- Plex provisional rows can be kept indefinitely or cleaned up according to configured retention behavior

## Open Questions

- should source retention settings live in config files, the database, or both?
- should raw records and normalized watch events share one retention window, or should they be configurable separately?
- should import-job audit records also have retention controls?
- should provisional Plex retention be a dedicated sub-setting or simply follow the broader Plex source-retention policy?
- should retention cleanup be previewable before it runs?
