# Feature 12: Analytics Tab

## Purpose

Add a dedicated analytics section alongside Week, Month, Year, and Sources so the user can understand not just what they watched, but how the dataset and imports are evolving over time.

This feature should follow the retention and source-management work closely enough that analytics can explain both watch behavior and dataset behavior clearly.

## Product Goal

Create an analytics tab that surfaces useful, real data about watch activity, import health, and dataset growth without turning the app into a generic BI dashboard.

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

## Implementation Plan

### Phase 1: Metric Inventory

- define which analytics are already supported by stored data
- avoid metrics that depend on future schema work
- separate user-value metrics from internal-only metrics

Exit criteria:
- the first analytics slice is explicitly scoped and queryable from current data

### Phase 2: Information Architecture

- design the analytics tab layout
- define how it differs from timeline views
- decide which metrics belong in cards, charts, or ranked lists

Exit criteria:
- the analytics tab has a coherent structure rather than a loose collection of widgets

### Phase 3: Queries And UI

- implement analytics queries backed by real stored data
- add the analytics route and navigation
- render dataset and watch analytics clearly on desktop and mobile

Exit criteria:
- the analytics tab loads meaningful real metrics from the existing dataset

## Acceptance Criteria

- the main navigation includes an analytics tab
- the analytics tab uses only real stored data
- the tab includes both watch-history and dataset-growth insights where supported
- the analytics UI is distinct from timeline views but consistent with the current app
- the tab remains useful even when data volume is still modest

## Open Questions

- should analytics ship as one broad tab or start with a smaller v1 slice?
- which dataset-growth metrics matter most to the user versus only to development?
- how much charting is appropriate before a dedicated charting system exists?
- should source-health trends live in analytics, sources, or both?
- how should retention effects be reflected once feature 11 exists?
