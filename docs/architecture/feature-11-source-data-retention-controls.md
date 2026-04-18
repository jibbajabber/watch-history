# Feature 11: Source Data Retention Controls

## Purpose

Give the user explicit control over how long source data is retained, per source, across both raw imported records and normalized watch history.

This feature should build on the completed Home Assistant and Plex continuity work. It should not weaken source-truth behavior, but it should make retention a deliberate product setting instead of an accidental side effect of current import logic.

## Product Goal

Let the user decide whether each source keeps data indefinitely or purges data older than a configured retention window, while keeping the purge model understandable, auditable, and source-specific.

## Scope

Included:
- discovery of all currently retained source data surfaces, including `raw_import_records`, `watch_events`, and any source-specific provisional rows
- per-source retention settings stored in the same non-secret source YAML files that already hold sync settings
- support for an "indefinite retention" mode
- support for a general time-based history retention window expressed in days
- support for a separate provisional-retention window expressed in hours where the source has provisional rows
- source-specific handling for Plex provisional rows that have not yet become durable history
- scheduled cleanup behavior that runs inside the existing Docker-managed environment
- UI on `/sources` for viewing and editing retention settings alongside sync settings
- documentation of exactly what data is purged when a retention rule is applied

Excluded:
- analytics and reporting visualizations about data growth over time
- cross-source global retention that overrides all source-specific settings by default
- speculative deletion of metadata that belongs to unrelated future entities
- a schema migration for a new generic retention-settings table unless implementation evidence shows the YAML-backed v1 model is insufficient

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

For v1, retention should follow the current source-configuration pattern:
- `configs/home-assistant.yaml` should hold non-secret Home Assistant retention settings
- `configs/plex.yaml` should hold non-secret Plex retention settings
- the `/sources` page should edit those values through server actions, the same way sync settings already work

### Retention Surfaces

Feature 11 should explicitly cover the data surfaces that already exist in the current schema and import model:
- `raw_import_records`
- `watch_events`
- `import_jobs`
- Plex provisional rows represented today as `watch_events.metadata.is_provisional = true`

The policy should be transparent:
- if old raw records are purged, the user should understand that old normalized history may also disappear or become non-rebuildable
- if normalized watch events are retained longer than raw rows, that should be a conscious policy choice, not an accident
- import-job retention should be called out as operational audit retention rather than watch-history retention

Current repository grounding:
- Home Assistant currently rebuilds normalized sessions from all persisted Home Assistant raw rows for the configured entities
- Plex currently rebuilds durable history from persisted Plex raw history rows and also stores provisional session-derived `watch_events`
- both sources already store scheduled-sync settings in YAML and expose them in `/sources`
- the worker already runs once per minute and is the correct place to trigger cleanup checks

### Retention Model

Feature 11 should start with one shared shape across sources, with an optional provisional override where needed.

Candidate config shape:

```yaml
retention:
  mode: indefinite
```

Or:

```yaml
retention:
  mode: windowed
  history_days: 365
  import_job_days: 90
  provisional_hours: 24
```

Semantics:
- `mode: indefinite` means the source keeps raw records, normalized watch events, and import-job rows unless durable-import logic replaces or updates them normally
- `history_days` applies to both `raw_import_records` and non-provisional `watch_events` for that source so durable raw evidence and durable normalized history age out together in v1
- `import_job_days` applies to `import_jobs` rows for that source and is intentionally separate because those rows are operational audit data
- `provisional_hours` applies only to source-specific provisional rows and is currently relevant only to Plex

Why this v1 shape:
- it avoids a misleading configuration where raw rows disappear but dependent normalized history silently stays behind
- it keeps Home Assistant and Plex aligned on the main history-retention concept
- it still leaves room for Plex-specific provisional cleanup without forcing Home Assistant to expose meaningless extra controls

### Retention Units

Not every retention control needs the same unit:
- long-term history retention likely belongs in days
- provisional row cleanup may reasonably use hours

Feature 11 should expose:
- one general source history-retention window in days
- one import-job audit-retention window in days
- an optional provisional-retention window in hours for sources that use provisional rows

## Candidate UX Changes

### Source Retention Block

Potential additions to each source card:
- `Retention` status summary
- `Keep indefinitely` toggle
- history-retention days input when cleanup is enabled
- import-job retention days input
- provisional-retention hours input for Plex only
- source-specific explanatory copy that states what will be deleted

### Retention Warnings

Potential UX safeguards:
- warn before shrinking a retention window below currently stored data age
- explain whether cleanup affects raw records, normalized history, or both
- clarify that retention changes apply on the next cleanup cycle and may delete already-stored rows older than the new window

### Source Card Copy Direction

The `/sources` screen should continue to read as an operational control surface.

Retention copy should therefore stay concrete:
- what is currently kept
- what will be deleted once cleanup is enabled
- when cleanup runs
- whether provisional Plex sessions are governed separately

## Implementation Plan

### Phase 1: Discovery

- inventory what data each source currently stores
- decide what should be retained indefinitely by default
- decide what data categories are safe to purge
- confirm the current provisional Plex marker and query shape
- confirm the cleanup ordering needed so raw-row deletion does not leave inconsistent source-specific rebuild behavior

Exit criteria:
- the repository has a documented retention model for Home Assistant and Plex grounded in the current schema and importer behavior

### Phase 2: Configuration Model

- extend `configs/home-assistant.yaml` and `configs/plex.yaml` parsing/writing with non-secret retention settings
- support `indefinite` retention explicitly
- support time-based retention for enabled cleanup
- define defaults for missing retention config so existing installs remain valid

Exit criteria:
- the product has a clear source-retention configuration shape

### Phase 3: Cleanup Execution

- implement cleanup inside the Docker-managed worker model
- ensure cleanup is idempotent and safe
- ensure cleanup does not race with imports
- ensure cleanup order is deliberate:
  - remove source-specific provisional rows older than `provisional_hours`
  - remove durable `watch_events` and `raw_import_records` older than `history_days`
  - remove `import_jobs` older than `import_job_days`
- guard cleanup with the same per-source advisory-lock pattern already used by imports, or an equivalent source-safe mechanism

Exit criteria:
- cleanup can run automatically without corrupting source continuity

### Phase 4: Source UI

- expose retention state and controls to the user
- explain what the setting affects
- preserve a clear operational view on `/sources`
- keep retention editing in the existing source-card actions flow rather than introducing a separate admin page in v1

Exit criteria:
- the user can inspect and change source retention settings without editing files manually

## Acceptance Criteria

- each source has an explicit retention policy, including an indefinite mode
- the user can control source retention without editing code
- retention behavior is documented in plain language
- cleanup runs inside the existing Docker-managed environment
- cleanup does not break Home Assistant or Plex continuity guarantees for data that remains inside the configured retention window
- Plex provisional rows can be kept indefinitely or cleaned up according to configured retention behavior
- Home Assistant and Plex continue to default to safe retention behavior when no new retention config has been saved yet
- the `/sources` page makes it clear that `history_days` deletes both durable raw records and durable normalized watch history for that source

## Open Questions

- should import-job audit retention be user-editable in v1 or shipped with a sensible fixed default and surfaced later?
- should the UI allow shrinking a retention window immediately, or require an explicit confirmation step when stored data older than the new window exists?
- should cleanup run on every worker tick once enabled, or on a coarser cadence such as once per day per source?
- do we want a user-visible "last cleanup" timestamp on `/sources` in v1, or is documentation plus import-job evidence enough for the first pass?

## Review Notes

Repository review on 2026-04-18 confirms:
- the current schema already contains the main retention surfaces: `raw_import_records`, `watch_events`, and `import_jobs`
- Plex provisional data is not stored in a separate table today; it is represented as `watch_events` rows with `metadata.is_provisional = true`
- source-managed non-secret settings already live in YAML and are editable from `/sources`, so retention should follow that same pattern in v1 unless implementation friction proves otherwise
- the existing `scripts/source-sync-worker.ts` loop is the correct cleanup executor because it already runs inside Docker Compose and coordinates source-specific scheduled work
- the main unresolved product choice is not where cleanup runs, but how much of the retention model should be user-editable in the first pass versus defaulted conservatively
