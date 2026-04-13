# Feature 4: UI Summaries And Analytics

## Purpose

Improve the timeline experience after the first successful Home Assistant import by making the aggregated views more informative, readable, and useful.

This feature builds on the existing week, month, and year views and focuses on presentation and interpretation rather than new source ingestion.

## Product Goal

Turn imported watch events into higher-quality summaries so the application helps the user understand patterns over time, not just scan raw events.

## Scope

Included:
- improve timeline summary cards
- improve side-panel grouping and "Moments" summaries
- add higher-quality weekly, monthly, and yearly rollups
- add useful watch analytics based on imported data
- improve empty, partial, and edge-case summary behavior

Excluded:
- new source integrations
- major changes to authentication or import pipelines
- speculative analytics that depend on metadata the app does not reliably have yet

## Candidate Improvements

### Timeline Summaries

- make the right-hand grouping panel consistently populate from imported data
- surface top titles, most active days, and most used sources
- improve summary-card usefulness beyond counts and total minutes

### Weekly View

- show streak-like activity patterns
- highlight most-watched title of the week
- highlight busiest day or busiest viewing window

### Monthly View

- surface total watch time by day
- show month-over-month density and high-activity clusters
- highlight repeated titles or rewatches

### Yearly View

- summarize watch time and event counts by month
- identify most active months
- create a stronger overview that encourages drilling into month detail

## Data Requirements

This feature should rely on already-normalized watch events and their derived durations.

Potential derived metrics:
- total watch minutes
- events per day
- sessions per title
- sessions per source
- active days per range
- longest session

## Implementation Plan

### Phase 1: Query Improvements

- define the extra aggregate queries needed for week, month, and year analytics
- make grouped timeline summaries populate reliably for imported data

### Phase 2: UI Improvements

- redesign summary cards with higher-value metrics
- improve side-panel content and visual hierarchy
- make analytics readable on both desktop and mobile

### Phase 3: Edge Cases

- handle sparse data gracefully
- handle very dense data without overwhelming the layout
- ensure missing metadata does not break summary rendering

## Acceptance Criteria

- week, month, and year views surface more than raw event counts
- the side panel consistently shows meaningful grouped summaries
- the application highlights useful patterns from imported data
- analytics remain understandable on mobile and desktop

## Open Questions

- which analytics are genuinely valuable to the user versus decorative?
- how should rewatches be surfaced when title matching is still heuristic?
- should analytics stay simple and readable, or expand into a more explicit dashboard layer?
