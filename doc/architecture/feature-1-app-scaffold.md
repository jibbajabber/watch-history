# Feature 1: Application Scaffold And Timeline Views

## Purpose

Build the first usable version of the product as a visually polished web application with a strong application shell and timeline-first navigation.

This feature establishes:
- the container-first development environment
- the app shell and design system
- the first database and backend shape
- the weekly, monthly, and yearly watch-history views

This feature should be reviewed and approved before implementation begins.

## Product Goal

Create a beautiful and visually appealing web application for tracking what has been watched over time.

Working name:
- `Watch History`

Candidate alternate names to evaluate during design:
- `Rewatch`
- `Watchback`
- `Seen It`
- `Watched`

Unless branding changes are intentionally approved, use `Watch History` as the default product name.

## User Experience Goals

- The first screen should emphasize what was watched in the last 7 days.
- Navigation between week, month, and year views should be obvious and fast.
- The visual design should feel deliberate and memorable rather than like a generic internal dashboard.
- Empty states should feel real and product-quality without depending on mocked watch-history content.
- The application should be structured so source integrations can later populate the same views without redesigning the UI.

## Scope

Included:
- Docker-based project scaffolding using `docker compose`
- project `Dockerfile` definitions for the app environment
- env-file-based configuration conventions
- frontend application shell
- backend API/application layer
- relational database setup
- canonical initial data model for timeline views
- weekly view
- monthly view
- yearly view
- empty, loading, and error states

Excluded:
- Amazon Prime import implementation
- Home Assistant integration
- multi-user features unless required by the initial stack choice
- advanced analytics beyond what is required to support week, month, and year browsing

## Recommended Architecture Direction

Prefer a full-stack web application with clear internal boundaries rather than a prematurely split frontend/backend system.

Recommended shape:
- web application service
- database service
- optional worker service if import/background jobs are needed early

Why:
- keeps the first milestone simpler
- supports a strong UI quickly
- reduces moving parts while the data model is still evolving
- fits the Docker-first workflow already established for the repository

Implementation note:
- this feature is now scaffolded as a Next.js full-stack application with PostgreSQL orchestrated through `docker compose`

## Information Architecture

### Primary Views

#### Weekly View

Purpose:
- show the last 7 days of watch activity as the default view

Behavior:
- order activity by recency
- surface item title, watched time, source, and media type where available
- make rewatches and multiple plays visible

#### Monthly View

Purpose:
- show a month at a time with clear day-level grouping

Behavior:
- group watch events by day
- make it easy to scan for patterns and bursts of activity
- support moving backward and forward month-by-month

#### Yearly View

Purpose:
- provide a higher-level calendar or summary layer for the year

Behavior:
- summarize activity by month
- act as a navigation layer into monthly detail
- help identify trends and inactive periods

## Initial Data Model Direction

The first milestone should define enough of the data model to support future imports without rebuilding the timeline layer.

Initial entities:
- `Source`
- `ImportJob`
- `RawImportRecord`
- `MediaItem`
- `WatchEvent`

Minimum requirements:
- raw source records are preserved
- normalized watch events drive the timeline UI
- each watch event has a timestamp suitable for week, month, and year aggregation
- source attribution is preserved for each event

## Implementation Plan

### Phase 1: Foundation

- choose the application stack
- create the repository scaffolding for app, database, and container config
- define Docker and `docker compose` setup
- define env-file conventions

### Phase 2: Core Application Shell

- create the base layout, routing, navigation, and visual language
- define typography, color tokens, spacing, and component primitives
- implement polished empty/loading/error states

### Phase 3: Timeline Data Layer

- create the initial schema for sources, imports, raw records, media items, and watch events
- create backend query shapes for weekly, monthly, and yearly views
- define how the UI requests and renders those views

### Phase 4: Timeline Screens

- implement weekly screen as the default landing screen
- implement monthly screen
- implement yearly screen
- add navigation between them

### Phase 5: Documentation

- document the project structure in `README.md`
- document container-based startup and workflow commands
- document env-file expectations

## Acceptance Criteria

- the stack starts through `docker compose`
- no host-local runtime workflow is required beyond Docker and `docker compose`
- the application renders polished week, month, and year views
- the week view is the default entry point
- the schema and application boundaries are ready for real source ingestion
- the app does not depend on mocked watch-history data as a normal operating mode

## Open Questions

- which application stack best fits the desired visual quality and full-stack simplicity?
- should the yearly view be a dense calendar, a monthly summary grid, or both?
- what minimum metadata should every `WatchEvent` require for v1?
- do we need a worker service from day one, or can imports be handled synchronously until feature 2 lands?
