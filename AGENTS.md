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
- Treat the repository `docker-compose.yml` as the canonical local deployment definition for the application stack.
- Do not assume the active application instance is running locally; the user may be operating the app on a remote Docker server instead.
- If the local Docker Compose stack is not already running, ask the user before starting it.
- When the active environment is remote, prefer asking the user to run commands or provide outputs from that remote Docker host rather than silently starting or substituting a local stack.
- When adding scripts, commands, or automation, document and design them to execute within the application containers.
- Treat live imported data as the default operating mode for the application; do not define product behavior around mocked datasets.
- Configure secrets for authenticated external services through environment variables supplied to the `docker compose` environment from an env file.
- Do not read `.env` files, `.env.*` files, secret override files, or similar local secret-bearing files unless the user explicitly asks for that inspection in the current task.
- When a task needs secret-backed behavior, prefer asking the user to run a command, confirm whether configuration exists, or provide a sanitized value rather than opening secret files directly.
- Record unresolved questions instead of inventing product behavior silently.
- Keep changes additive and traceable; avoid deleting prior decisions unless they are clearly superseded.
- If implementation begins before the spec is complete, document the rationale for any assumptions made.

## Feature Delivery Procedure

When starting or advancing a feature in this repository:
- Create or update a feature spec first at `docs/architecture/<feature-name>.md` before implementation work begins.
- Keep `docs/architecture/README.md` updated when a feature spec is added, renamed, removed, or changes role enough that the architecture index would become stale.
  When a feature has a PR, update the architecture index entry with the real PR number/link and a `Delivered` timestamp generated at PR creation time, including the correct day name in the format `Saturday, 18 April 2026, 18:30`.
- Use that spec to drive a review and discussion with the user before coding.
- Surface open questions explicitly and gather any missing real-world data before locking the implementation approach.
- Update all relevant project-definition files when a feature is introduced or clarified, including `AGENTS.md`, `README.md`, and any supporting discovery notes that materially inform the feature.
- Do not begin implementation on a new feature branch by default; first ask the user whether they want the branch created.
- If the user wants a branch created, create it from the feature name and do not include the file suffix such as `.md` in the branch name.
- Once a feature is implemented, ask the user whether they want the branch pushed.
- After that, ask the user whether they want a PR raised.
- When raising a PR from a feature branch, derive the title from the feature name or branch name by replacing hyphens with spaces and capitalizing each word.
- Keep the PR description simple and outcome-focused, summarizing what the feature achieves rather than reproducing the full implementation detail.
- Before closing out a feature, review `README.md` and mark the feature complete there if appropriate, along with any relevant file-purpose or workflow updates.
  Update the `README.md` `Current Structure` section whenever the feature adds files, directories, entrypoints, helpers, or changes the practical responsibility of an existing file or module enough that the codebase map would otherwise become stale.
  Use the level of detail that best explains the repo: call out individual files when they are meaningful navigation landmarks, but prefer a single directory-level entry when enumerating every file would add noise without improving the map.
- When adding future features to status sections in `README.md`, `AGENTS.md`, or related planning docs, list them under a planned or upcoming section until implementation is actually complete; do not place drafted or proposed features in completed sections just because a spec exists.
- If implementation or verification would require starting a stopped local Docker Compose stack, ask the user before doing that because the source of truth may currently be a remote Docker deployment.

## Engineering Standards

- Prefer simple, elegant solutions over clever abstractions.
- Keep the codebase modular, with small focused libraries/components and clear boundaries.
- Organize code so features and responsibilities are easy to locate, reason about, and test.
- Prefer testable seams around logic-heavy behavior so pure helper coverage can land before DB-backed or UI-heavy tests.
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
- The canonical automated test entrypoint is the `web` container; prefer `docker compose exec web ...` for `vitest`, coverage, and typecheck commands.
- Do not rely on locally installed host tools as part of the normal project workflow, beyond Docker and `docker compose` themselves.
- When examples or automation are added, prefer `docker compose run ...`, `docker compose exec ...`, or equivalent container-native entrypoints over host-local commands.
- If a task genuinely cannot run in the container environment, document the exception explicitly and treat it as a gap to close rather than the default approach.
- Pass application configuration and credentials needed by containers through environment variables wired into `docker compose`.

## Testing Workflow

- Use `vitest` as the v1 test runner for local automated testing.
- Prefer a failing or focused test first for logic-heavy feature work and reproducible bug fixes when practical.
- If strict test-first sequencing is not practical, add or update the relevant tests in the same change as the implementation.
- Keep the first testing slices focused on pure server-side helpers and extracted logic; widen into DB-backed or UI-heavy tests incrementally.
- Treat coverage output from `npm run test` as part of the normal verification feedback, but do not enforce minimum thresholds in Feature 14.

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
- Keep `docs/architecture/README.md` in sync with the architecture-spec directory so contributors have a current per-spec index instead of relying on implicit discovery.
  For completed features with PRs, record the actual PR number and derive the day-of-week for the `Delivered` timestamp from the current local date/time when the PR is raised.
- When those changes affect how a contributor navigates the repo, update the `README.md` `Current Structure` section in the same change rather than leaving the codebase map implicit.
- When setup steps, scripts, or workflows change, update `README.md` in the same change.
- At the end of a feature, review `README.md` and update it where needed so completed features, new files, changed responsibilities, and workflow changes are reflected accurately.
  This includes adding or revising `Current Structure` entries when the feature introduces new meaningful files or changes which files are important enough to call out.
  When a directory is better understood as one coherent area, document the directory's responsibility instead of exhaustively listing every file beneath it.
- Container-based development and execution commands should be documented as the default and preferred workflow.
- Required environment variables, env-file conventions, and secret-handling expectations should be documented clearly in `README.md`.
- If a file or module has a non-obvious responsibility, make that clear in code comments or in `README.md`.
- Keep documentation concise, current, and aligned with the actual repository state.

## Workflow Checklist

For new feature work, use this default sequence unless the user explicitly redirects it:
1. Create or refine the feature spec at `docs/architecture/<feature-name>.md`.
   Update `docs/architecture/README.md` in the same change when the spec inventory or feature map changes.
2. Review the spec with the user, answer open questions, and gather any real source data needed to de-risk the work.
3. Update `AGENTS.md`, `README.md`, and any other relevant docs to record the feature and its current status.
4. Ask the user whether they want a feature branch created before implementation starts.
5. If they do, create the branch from the feature name without the `.md` suffix.
6. Before starting a stopped local Docker Compose stack for implementation or verification, ask the user whether they want that local stack started.
7. Implement, verify, and document the feature.
8. Review `README.md` at feature close-out and update it where needed to mark the feature complete and document any new files, changed responsibilities, or workflow changes.
   Update the `Current Structure` section whenever those changes materially affect how a contributor should understand or navigate the repo.
   Planned or draft follow-up features should remain explicitly marked as planned rather than being added to completed feature lists.
9. Update `AGENTS.md` and other relevant docs to record the feature as complete.
10. Prepare a concise summary of the completed change that can be used directly or adapted into a commit message when the user is ready to commit.
11. When the feature is complete, ask whether the user wants the branch pushed.
12. Ask whether the user wants a PR raised.
13. If a PR is raised, use a Title Case title derived from the feature name or branch name with hyphens replaced by spaces, and write a short description summarizing what the feature achieves.
14. When the PR exists, update `docs/architecture/README.md` with the real PR reference and a `Delivered` timestamp derived at that time, including the correct day name rather than a guessed or copied label.

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
| 2026-04-13 | Feature 7 should use Plex history rows as the first v1 watch-event source. | The sampled `/status/sessions/history/all` payload is sufficient for raw import and completed-watch normalization, while device/progress enrichment remains optional follow-up work. |
| 2026-04-13 | Feature 7 implementation starts with env-based Plex connectivity and manual import. | Plex uses `PLEX_BASE_URL` and `PLEX_TOKEN`; manual import rebuilds Plex-derived `watch_events` from `/status/sessions/history/all` while preserving raw history rows. |
| 2026-04-13 | Plex imports should tolerate a short post-playback handoff gap between current sessions and durable history. | Plex does not document an exact moment when stopped playback appears in `/status/sessions/history/all`, so this should be treated as normal source behavior rather than a timezone bug. |
| 2026-04-13 | Feature 7 should include scheduled Plex sync before being marked complete. | Plex scheduled sync should run inside the same Docker-managed worker model as Home Assistant, using a non-secret `configs/plex.yaml` sync config and source-specific overlap protection. |
| 2026-04-13 | Feature 8 should focus on import reliability and source-health visibility. | Manual and scheduled imports should fail safely, retry on later intervals, update source health clearly, and surface a non-blocking warning banner in the shared app shell when relevant. |
| 2026-04-13 | Feature 9 should combine Plex enrichment with `/sources` UI cleanup. | This original Feature 9 scope is superseded by the 2026-04-18 renumbering decision and now continues as Feature 10. |
| 2026-04-13 | Feature 8 implementation starts with degraded source status and a shared shell warning banner. | Recent failed imports and stale scheduled sources should be visible without blocking the app, while scheduled retries continue on the normal worker interval. |
| 2026-04-13 | Feature 8 is complete with resilient import actions, worker hardening, and source-health visibility. | Failed manual imports now return safely to `/sources`, scheduled sync ticks are guarded against overlap and hangs, and the UI surfaces failing, stale, and recovered source states without blocking the app. |
| 2026-04-18 | Feature 9 is redefined to improve Home Assistant current-playing continuity for Sky Q. | The new priority is preserving programme history when Sky Q stays on the same channel and Home Assistant only exposes the latest current programme details. |
| 2026-04-18 | The previous Plex enrichment and `/sources` polish scope moves from Feature 9 to Feature 10. | Sky Q current-playing continuity is a higher-priority source-truth issue and should be addressed before further Plex/UI polish. |
| 2026-04-18 | Feature 9 is complete with raw-record-driven Home Assistant normalization. | Home Assistant imports now rebuild normalized watch events from persisted raw records so same-channel Sky Q programme transitions survive later imports. |
| 2026-04-18 | Agents should not read local env files or similar secret-bearing files unless the user explicitly asks. | Secret-backed tasks should prefer user-run commands, sanitized inputs, or explicit permission to inspect sensitive configuration. |
| 2026-04-18 | Feature work should follow a spec-first, review-first, branch-on-request workflow. | Define the feature under `docs/architecture`, review it with the user, update project docs, then ask whether to create a branch before implementation; after completion ask about push and PR steps. |
| 2026-04-18 | Agents must ask before starting a stopped local Docker Compose stack. | The canonical deployment definition is the repo `docker-compose.yml`, but the active application may be running on a remote Docker host that the user must interact with directly. |
| 2026-04-18 | PRs should use a feature-name-derived Title Case title and a short achievement-focused description. | Replace hyphens with spaces in the feature or branch name, capitalize each word, and keep the body concise. |
| 2026-04-18 | Feature close-out must include a README review. | Mark completed features in `README.md` where relevant and document any new files, responsibilities, or workflow expectations introduced by the feature. |
| 2026-04-18 | README close-out guidance must explicitly cover the `Current Structure` section. | When a feature changes the codebase map in a meaningful way, update `README.md` `Current Structure` in the same change rather than relying on implicit discovery. |
| 2026-04-18 | Feature 10 should rebuild Plex watch events from persisted raw history rows while treating active sessions as provisional. | Durable Plex history should no longer depend only on the latest fetch; current `/status/sessions` entries remain useful but must be shown as in-progress snapshots rather than final history. |
| 2026-04-18 | Feature 10 should replace `/sources` planning-oriented copy with operational summaries. | Source cards should emphasize health, freshness, sync cadence, and import state instead of internal next-step messaging. |
| 2026-04-18 | Feature 10 should keep provisional Plex sessions until durable history replaces them. | Hardcoded expiry for pending Plex sessions is deferred; broader cleanup and retention policy belongs in feature 11. |
| 2026-04-18 | Feature 11 should define per-source data-retention controls. | Retention should cover raw records, normalized watch events, import-job audit rows, and source-specific provisional data rather than only Plex pending sessions. |
| 2026-04-18 | Feature 11 v1 should reuse per-source YAML config and `/sources` editing patterns. | Retention should ship first as non-secret source config alongside sync settings, with history retention in days and optional provisional retention in hours where the source needs it. |
| 2026-04-18 | Feature 11 is complete with per-source YAML retention settings and worker cleanup. | `/sources` now edits retention alongside sync settings, Home Assistant and Plex default safely to indefinite retention, and cleanup removes only data outside the configured source window while protecting raw-row-linked import jobs. |
| 2026-04-18 | Feature 12 should add a dedicated analytics tab. | Analytics should cover both watch behavior and dataset growth using only real stored data. |
| 2026-04-18 | Feature 12 v1 should start as a single analytics destination with overview, watch patterns, dataset growth, and import activity sections. | The first slice should use only existing `watch_events`, `raw_import_records`, `import_jobs`, and `sources` data, without adding speculative health-history or metadata-heavy dashboards. |
| 2026-04-18 | Feature 12 is complete with a dedicated analytics tab. | `/analytics` now exposes real-data overview totals, monthly watch and dataset trends, source contribution, and recent import activity using only stored `watch_events`, `raw_import_records`, `import_jobs`, and `sources` data. |
| 2026-04-18 | Feature 13 should add favourites and recommendation curation on top of timeline history. | The product needs a user-owned curation layer so meaningful content can be favourited, recommended, or hidden without destroying source-truth imports. |
| 2026-04-18 | Feature 14 should establish a container-first automated testing workflow with TDD guidance. | Tests should run through the Docker-managed environment, update contributor workflow expectations, and leave a clear decision on whether GitHub Actions is included here or split into Feature 15. |
| 2026-04-18 | Resume-default scope for Feature 13 is event-level curation with reversible hiding. | Unless the user redirects, curation attaches to `watch_events`, hidden items are suppressed rather than deleted, and hidden items should be excluded from default timeline and analytics views. |
| 2026-04-18 | Feature 13 v1 should ship as watch-event curation plus a dedicated `/favourites` route. | Use a narrow `watch_event_curation` model, keep imports unchanged, add a visible desktop action trigger alongside touch long-press, and make hidden items recoverable from the curated view. |
| 2026-04-18 | Feature 13 should store only a single favourite flag in v1. | `Favourites` remains the destination name; recommendation wording can appear in supporting UI copy or actions, but it should not be a separate persisted state. |
| 2026-04-18 | Feature 13 stores curation by source plus stable event key so it survives import rebuilds. | Current Home Assistant and Plex imports rebuild `watch_events`, so favourites and hidden-item state join by durable source/event identity rather than a transient row id. |
| 2026-04-18 | Feature 13 is complete with a dedicated `/favourites` route and timeline curation controls. | Timeline rows now support favourite and hide actions with a visible desktop trigger and touch long-press, hidden items drop out of default timeline and analytics views, and `/favourites` can recover hidden entries. |
| 2026-04-18 | Resume-default scope for Feature 14 is Docker-first local testing with CI deferred. | Unless the user redirects, the first testing milestone should use `vitest`, target logic-heavy server-side code first, and leave GitHub Actions for Feature 15. |
| 2026-04-18 | Feature 14 planning now fixes the first test slice to container-first `vitest` coverage for pure server-side helpers before DB-backed tests. | Initial targets should start with retention, formatting, and extracted source-status logic from the existing app code, with GitHub Actions still deferred to Feature 15. |
| 2026-04-18 | Feature 14 implementation starts with `vitest` coverage in the `web` container and pure helper tests. | The initial automated suite covers formatting, retention config logic, and extracted source-status helpers, with coverage output shown by `npm run test` and no minimum threshold yet. |
| 2026-04-18 | Feature 14 is complete with container-first `vitest` workflow and coverage output. | The repository now has Docker-native test commands, helper-focused automated coverage, README and AGENTS TDD guidance, and CI intentionally deferred to Feature 15. |
| 2026-04-18 | Feature 14 coverage expansion now includes extracted timeline and analytics helpers. | The helper-focused suite now covers timeline shaping and analytics response mapping in addition to formatting, retention, and source-status logic, while DB-backed import and query coverage remains a follow-up slice. |

## Next Discovery Steps

1. Pick up Feature 15 for CI or GitHub Actions now that the local container-first test workflow exists.
2. Decide whether the next testing slice should target DB-backed importer coverage or continue expanding pure server-side helper coverage.
3. Decide whether day-of-week patterns and streak-style metrics belong in a Feature 12 follow-up pass or a later feature.

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
- Feature 7: Complete
  Plex source support is implemented with env-based connectivity, manual history import, active-session enrichment, and scheduled sync.
- Feature 8: Complete
  Import reliability, source-health status, safe manual failure handling, worker resilience, and shared warning-banner behavior are implemented.
- Feature 9: Complete
  Home Assistant imports now rebuild from persisted raw records so long same-channel Sky Q viewing preserves programme history across repeated imports.
- Feature 10: Complete
  Plex imports now rebuild durable watch events from persisted raw history rows, provisional active sessions are shown as in-progress timeline entries, and `/sources` now emphasizes operational summaries over internal next-step copy.
- Feature 11: Complete
  Source data-retention controls are implemented with per-source YAML settings, `/sources` editing, worker-driven cleanup, durable-history cleanup, and Plex provisional retention handling.
- Feature 12: Complete
  A dedicated analytics tab is implemented with overview totals, watch-pattern trends, dataset growth, source contribution, and recent import activity from real stored data.
- Feature 13: Complete
  A curation layer now lets the user favourite and hide individual timeline items, uses recommendation-oriented language in the curated experience, excludes hidden items from default timeline and analytics views, and recovers curated entries from a dedicated `/favourites` tab built on top of imported history.
- Feature 14: Complete
  The repository now has a container-first local automated testing workflow using `vitest`, text and HTML coverage output, initial helper-focused tests, and documented TDD expectations, with CI deferred to Feature 15.
