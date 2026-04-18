# Feature 12: Analytics Tab

## Purpose

Add a dedicated analytics section alongside Week, Month, Year, and Sources so the user can understand not just what they watched, but how the dataset and imports are evolving over time.

This feature should follow the retention and source-management work closely enough that analytics can explain both watch behavior and dataset behavior clearly.

## Product Goal

Create an analytics tab that surfaces useful, real data about watch activity, import health, and dataset growth without turning the app into a generic BI dashboard.

## Current Stored Data Inventory

Feature 12 should be designed around the tables and fields the app already has today:
- `watch_events`: normalized watch sessions with `source_id`, `title`, `media_type`, `watched_at`, `duration_minutes`, and source-specific `metadata`
- `raw_import_records`: persisted source rows with `source_id`, `imported_at`, and full source payloads
- `import_jobs`: import run history with `status`, `started_at`, `completed_at`, `records_seen`, `records_imported`, and `error_message`
- `sources`: registered integrations and source identity

That means the first analytics slice can reliably answer:
- how many normalized watch events, raw records, and import jobs currently exist
- how those counts changed over recent days or months
- which sources contributed the most durable watch events and raw rows
- when the user was active, how often they watched, and which titles or sources repeat
- how often imports are running and how many are succeeding versus failing

It should not pretend to answer:
- exact runtime-based viewing totals when `duration_minutes` is missing
- title, genre, or release-year analysis that depends on a fully normalized `media_items` layer
- source-health history over time, because the app stores latest operational state more clearly than longitudinal health snapshots

## Scope

Included:
- a new top-level analytics tab in the main app navigation
- user-facing visual summaries that go beyond the current week, month, and year timeline summaries
- operational analytics such as data-size growth over time, source contribution, import cadence, and source health trends where supported by real stored data
- watch-history analytics such as streaks, totals, session distribution, top sources, and title repetition where that is grounded in actual imported data
- design work to make the analytics surface distinct from timeline views while still fitting the current product

Excluded:
- retention-setting controls themselves
- speculative analytics that require data the product does not actually store
- mock-driven dashboards

## Problem Statement

The current application has:
- timeline views for Week, Month, and Year
- a Sources screen for operational control
- summary cards and highlights within timeline views

What it does not yet have is a place for deeper cross-cutting analysis:
- source contribution over time
- storage or record growth trends
- import volume trends
- longitudinal watch behavior summaries outside the fixed timeline slices

That leaves an obvious product gap once data accumulates.

## Design Direction

### Analytics As A First-Class Section

Analytics should sit next to Week, Month, Year, and Sources as a top-level destination.

It should answer questions like:
- how much data do I have now?
- which sources are contributing most?
- how is my dataset growing over time?
- what patterns stand out across the whole imported history?

### Dual Focus

The analytics surface should likely balance two kinds of information:
- watch analytics: titles, sessions, streaks, source mix, active periods
- dataset analytics: raw-row growth, watch-event growth, import activity, source volume, retention effects

This should remain a Watch History product screen, not a generic admin console.

### Real Data Only

Analytics must come from actual stored data:
- `watch_events`
- `raw_import_records`
- `import_jobs`
- source metadata already in the application

If a metric is not backed by stored data, it should not appear.

## V1 Product Slice

Feature 12 should ship as one focused analytics destination with four sections rather than an open-ended dashboard.

### 1. Overview

Headline cards grounded in current totals and recent change:
- total watch events stored
- total raw import records stored
- total import jobs run
- active watch days over the last 30 days
- net growth over the last 7 and 30 days for watch events and raw records

### 2. Watch Patterns

Cross-history watch behavior from durable `watch_events`:
- watch events by month for the last 12 months
- active days by month for the last 12 months
- top titles by session count
- top sources by session count
- day-of-week and time-of-day activity summaries when enough rows exist to make them readable

### 3. Dataset Growth

Operational dataset shape from persisted rows:
- raw records added by month
- watch events added by month
- source contribution split across durable watch events and raw records
- earliest and latest captured activity dates so the user can see the current history window

### 4. Import Activity

Import-run behavior from `import_jobs`:
- imports by source over the last 30 days
- success versus failure counts by source over the last 30 days
- latest successful import time per source
- average imported rows per successful run where current columns support it

## Deliberate V1 Exclusions

These ideas are explicitly deferred unless later schema work makes them trustworthy:
- charts that depend on client-side charting libraries not yet in the stack
- inferred "health trends" that would reconstruct history from the latest source status heuristics
- genre, ratings, reviews, recommendations, or metadata-enrichment dashboards
- retention-effect analytics beyond current row counts and visible history windows
- fully bespoke per-source drill-down screens

## Candidate Analytics Areas

### Dataset Overview

Potential cards:
- total raw records stored
- total normalized watch events stored
- source count with imported data
- growth over the last 7, 30, and 90 days

### Source Contribution

Potential views:
- watch events by source over time
- raw records by source over time
- imports run by source
- failures or stale periods by source

### Watch Behavior

Potential views:
- active days per month
- top titles across all time
- longest streaks
- rewatches or repeated sessions
- time-of-day and day-of-week viewing patterns

## Proposed Route And Code Shape

The first implementation should fit the existing app structure instead of introducing a separate analytics subsystem:
- add `analytics` to `AppSection` in `lib/types.ts`
- add a dedicated route at `app/analytics/page.tsx`
- add an analytics data module, likely `lib/analytics.ts`, responsible for query assembly and response shaping
- add an analytics screen component, likely `components/analytics-screen.tsx`, for page composition
- add one or more focused analytics presentation components under `components/analytics/`
- optionally add `app/api/analytics/route.ts` only if the page genuinely benefits from a separate data endpoint; server-rendered loading from `lib/analytics.ts` is the simpler default

This keeps navigation, server rendering, and query ownership aligned with the rest of the app.

## Implementation Plan

### Phase 1: Metric Inventory

- define which analytics are already supported by stored data
- avoid metrics that depend on future schema work
- separate user-value metrics from internal-only metrics
- lock the v1 sections to overview, watch patterns, dataset growth, and import activity

Exit criteria:
- the first analytics slice is explicitly scoped and queryable from current data

### Phase 2: Information Architecture

- design the analytics tab layout
- define how it differs from timeline views
- decide which metrics belong in cards, charts, or ranked lists
- prefer simple bar, grid, and ranked-list presentations that can be rendered with existing CSS before introducing a charting dependency

Exit criteria:
- the analytics tab has a coherent structure rather than a loose collection of widgets

### Phase 3: Queries And UI

- implement analytics queries backed by real stored data
- add the analytics route and navigation
- render dataset and watch analytics clearly on desktop and mobile
- keep the tab useful when the dataset is still small, sparse, or dominated by one source

Exit criteria:
- the analytics tab loads meaningful real metrics from the existing dataset

## Acceptance Criteria

- the main navigation includes an analytics tab
- the analytics tab uses only real stored data
- the tab includes both watch-history and dataset-growth insights where supported
- the tab includes import-run analytics grounded in `import_jobs`
- the analytics UI is distinct from timeline views but consistent with the current app
- the tab remains useful even when data volume is still modest

## Open Questions

- should day-of-week and time-of-day patterns ship in the first cut or wait until the core monthly and source views are in place?
- do we want longest streaks in v1, or is that too sensitive to sparse and provisional data?
- should import-activity cards emphasize the last 30 days only, or also include all-time totals?
- how explicitly should analytics call out retention windows so users understand why older raw rows may no longer exist?
