# AGENTS.md

## Purpose

This repository is for planning and building a web application that tracks media content watched over time by aggregating data from multiple sources.

This file is the working coordination and project-definition document for future agent and human contributions. Update it as product scope, architecture, and implementation details become clearer.

## Current Product Direction

Working concept:
- Build a web app that imports watch-history data from multiple platforms/sources.
- Normalize that data into a single timeline of watched media activity.
- Let the user review, search, filter, and understand what they watched and when.

Initial scope assumptions:
- The app will likely support movies, TV, and possibly online video/media sources.
- Source systems may differ in metadata quality, timestamps, identifiers, and export mechanisms.
- Deduplication and source reconciliation will be core product concerns.

## Agent Instructions

When working in this repository:
- Treat `AGENTS.md` as the top-level source of product and workflow context until more formal docs exist.
- Prefer updating this file when a requirement, assumption, or decision becomes concrete.
- Keep `README.md` updated whenever project structure, setup, workflows, or major file responsibilities change.
- Use `README.md` as the primary human-facing map of the codebase, including how the project is structured and what each major file or directory is for.
- Treat the containerized development environment as canonical; do not introduce host-local setup steps as the primary workflow.
- Run project tooling inside the Docker environment orchestrated by `docker compose`, not directly on the host machine.
- When adding scripts, commands, or automation, document and design them to execute within the application containers.
- Treat live imported data as the default operating mode for the application; do not define product behavior around mocked datasets.
- Configure secrets for authenticated external services through environment variables supplied to the `docker compose` environment from an env file.
- Record unresolved questions instead of inventing product behavior silently.
- Keep changes additive and traceable; avoid deleting prior decisions unless they are clearly superseded.
- If implementation begins before the spec is complete, document the rationale for any assumptions made.

## Engineering Standards

- Prefer simple, elegant solutions over clever abstractions.
- Keep the codebase modular, with small focused libraries/components and clear boundaries.
- Organize code so features and responsibilities are easy to locate, reason about, and test.
- Avoid tightly coupled modules and broad shared utilities that accumulate unrelated concerns.
- Add abstractions only when they reduce complexity or duplication in a durable way.
- Favor maintainability and readability over premature optimization.
- Keep public interfaces small and explicit.
- Design for incremental growth so new sources and media types can be added without destabilizing existing code.

## Planning Principles

- Favor a source-first model: preserve original imported records where possible.
- Separate raw imports from normalized application data.
- Design for repeat imports and idempotent sync behavior.
- Expect conflicting metadata across sources and define merge rules explicitly.
- Make time-based analysis a first-class feature, not an afterthought.
- Prefer simple initial scope over premature support for every media platform.
- Standardize development and tooling around containers so environment drift between contributors is minimized.
- Design around real import flows and live source data rather than mocked or fabricated watch-history datasets.

## Data Policy

- The application should use live, real imported data as its primary and intended data source.
- Do not build core product flows, UI states, or operational assumptions around mocked data.
- When testing or validating ingestion behavior, prefer real exports, real API responses, or sanitized real-world fixtures derived from actual source formats.
- If synthetic or fixture data is temporarily required for a narrow engineering purpose, keep it clearly scoped to tests or isolated development support and do not present it as the normal application mode.
- Any gap that forces reliance on mocked data in the running application should be documented as a temporary limitation to remove, not a stable product decision.

## Environment And Tooling Direction

- Use `docker compose` to orchestrate the application and supporting services in development.
- Maintain one or more project `Dockerfile` definitions that describe the application runtime and toolchain explicitly.
- Treat the Docker image definition as the authoritative description of the development and execution environment.
- All application tooling should run inside this Docker-managed environment, including dependency installation, app startup, tests, linting, formatting, code generation, and one-off maintenance tasks.
- Do not rely on locally installed host tools as part of the normal project workflow, beyond Docker and `docker compose` themselves.
- When examples or automation are added, prefer `docker compose run ...`, `docker compose exec ...`, or equivalent container-native entrypoints over host-local commands.
- If a task genuinely cannot run in the container environment, document the exception explicitly and treat it as a gap to close rather than the default approach.
- Pass application configuration and credentials needed by containers through environment variables wired into `docker compose`.

## Configuration And Secrets

- When external services require authentication, provide credentials to the application through environment variables.
- Supply those environment variables to the `docker compose` environment via an env file rather than hardcoding values in source control or relying on ad hoc host-shell exports.
- Keep secret values out of committed files; document required variable names and expected formats without committing real credentials.
- Design application configuration so containerized services can start with env-file-driven settings in a predictable way across contributors and environments.
- If local overrides or multiple env files are needed later, document the precedence rules explicitly in `README.md` and compose configuration.

## Candidate Feature Areas

- Source connection/import management
- Watch-history ingestion pipeline
- Metadata normalization and enrichment
- Duplicate detection and merge review
- Timeline and history views
- Search, filters, and summaries
- Manual corrections and user overrides
- Import audit trail and error reporting

## Open Product Questions

- Which media sources matter first?
- Will imports be file-based, API-based, or both?
- Is the product single-user only, or should multi-user support exist later?
- What counts as a unique watched item: title, episode, play event, or session?
- How should rewatches be represented?
- How much manual editing should the user be able to do?
- Do we need ratings, reviews, tags, or notes?
- What analytics matter most: streaks, totals, trends, genres, platforms, runtime?
- Should the app enrich missing metadata from third-party databases?
- What privacy constraints apply to imported viewing history?
- How should sanitized real-world fixtures be handled for tests without drifting into a mock-driven product workflow?
- Which Home Assistant state changes and attributes from the Sky Q entities are reliable enough to define a watched item?

## Early Domain Model Ideas

Potential entities:
- `Source`
- `ImportJob`
- `RawImportRecord`
- `MediaItem`
- `MediaVersion`
- `WatchEvent`
- `Series`
- `Season`
- `Episode`
- `UserOverride`

Potential relationship direction:
- A `Source` produces many `ImportJob` records.
- An `ImportJob` stores many `RawImportRecord` entries.
- Raw records are transformed into normalized `WatchEvent` records.
- `WatchEvent` records reference normalized media entities.
- User overrides can supersede automated matching or metadata decisions.

## Architecture Questions To Resolve

- Monolith or separated frontend/backend?
- Relational database choice?
- Background jobs needed for imports and enrichment?
- Authentication required for v1?
- How should the Docker image and `docker compose` services be structured for app, database, and background jobs?
- Deployment target?

## Documentation Standards

- `README.md` should be maintained alongside code changes, not updated later as cleanup.
- When new directories, modules, or libraries are introduced, document their purpose in `README.md`.
- When setup steps, scripts, or workflows change, update `README.md` in the same change.
- Container-based development and execution commands should be documented as the default and preferred workflow.
- Required environment variables, env-file conventions, and secret-handling expectations should be documented clearly in `README.md`.
- If a file or module has a non-obvious responsibility, make that clear in code comments or in `README.md`.
- Keep documentation concise, current, and aligned with the actual repository state.

## Decision Log

Use this section to record decisions as they are made.

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-04-12 | Created initial repository coordination file. | Starting from product-definition mode before implementation. |
| 2026-04-12 | Established engineering preference for simple, elegant, modular design. | Code should favor maintainability and clear boundaries. |
| 2026-04-12 | `README.md` must be kept current with project structure and file responsibilities. | Documentation updates should accompany structural and workflow changes. |
| 2026-04-12 | `docker compose` is the required orchestration layer for local development. | Development workflows should assume container-managed services rather than host-local execution. |
| 2026-04-12 | The project should define its runtime/tooling environment through project `Dockerfile` definitions. | The container image is the canonical environment description for contributors and agents. |
| 2026-04-12 | Project tools should run inside the Docker environment, not directly on the host. | Applies to installs, app commands, tests, linting, formatting, and maintenance tasks unless explicitly documented otherwise. |
| 2026-04-12 | The application should operate on live imported data, not mocked data, as its normal mode. | Mocked or synthetic data may exist only in tightly scoped test/support scenarios and should not define product behavior. |
| 2026-04-12 | Secrets for authenticated external services should be provided as environment variables via a Docker Compose env file. | Credentials should not be hardcoded or depend on ad hoc host-local shell configuration. |
| 2026-04-12 | Feature 1 is implemented as a full-stack Next.js application with PostgreSQL. | The current local stack is a Docker Compose-orchestrated web service plus database service. |
| 2026-04-12 | The first UI milestone provides weekly, monthly, and yearly timeline views backed by real database queries. | The application uses empty states instead of mocked watch-history content when no imported events exist. |
| 2026-04-12 | Home Assistant is now the first active source priority. | Authentication to Home Assistant comes before Sky Q watch-history ingestion. |
| 2026-04-12 | The initial Home Assistant integration should use a long-lived access token supplied via env vars. | This matches the current single-user, Docker-hosted deployment model and avoids premature browser auth complexity. |
| 2026-04-12 | Feature 4 should improve UI summaries and analytics on top of imported watch events. | Focus on making week, month, and year views more informative rather than adding a new source. |
| 2026-04-12 | Feature 5 should automate the verified Home Assistant import flow with scheduled sync. | Scheduled imports must continue to run inside the Docker-managed environment and remain idempotent. |
| 2026-04-12 | Feature 6 should add channel logos after an explicit discovery phase. | Logo rendering depends on stable channel identifiers and a documented asset strategy. |
| 2026-04-13 | Feature 6 starts with a curated local channel-logo registry and no schema migration. | Recognized Sky Q channels map to repo-local SVG assets through `lib/channels.ts`; unknown channels continue to fall back to text. |
| 2026-04-13 | The importer should prefer `media_channel` over `media_title` when deriving channel identity. | Raw Home Assistant attributes remain preserved in `watch_events.metadata.attributes` for future refinement of channel matching. |
| 2026-04-13 | Feature 6 is complete with channel and platform badges backed by a curated local registry. | Timeline rows now render recognized live-channel and app/platform brands from normalized Home Assistant metadata with text fallback for unknown labels. |
| 2026-04-13 | Feature 7 should add Plex as the next source integration. | The first Plex milestone should follow the same source-first, Docker-first, idempotent import model used by the existing Home Assistant flow. |

## Next Discovery Steps

1. Decide whether the first Plex import path should be API-based, file-based, or both.
2. Define the Plex credential and configuration model for Docker Compose.
3. Begin implementation from `docs/architecture/feature-7-plex-source-support.md`.

## Feature Progress

- Feature 1: Complete
  Docker-first app scaffold with weekly, monthly, and yearly timeline views is implemented.
- Feature 2: Complete
  Home Assistant authentication and connectivity checks are implemented.
- Feature 3: Complete
  Sky Q history import from Home Assistant entities is implemented.
- Feature 4: Complete
  Timeline summaries and analytics improvements are implemented.
- Feature 5: Complete
  Scheduled Home Assistant sync is implemented and configurable from the UI.
- Feature 6: Complete
  Channel and platform branding is implemented with a curated local registry, normalized mappings, and timeline-row rendering.
- Feature 7: Planned
  Plex source support is the next integration milestone and now has an architecture note.
