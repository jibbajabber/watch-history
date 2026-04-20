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
- Treat `docs/security/security.md` as the standing security-process reference for secret handling, browser/API exposure review, logging hygiene, and secure development flow.
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
- Prefer a failing or focused test first for logic-heavy feature work and reproducible bug fixes when practical, as long as the test does not require external DB infrastructure.
- If strict test-first sequencing is not practical, add or update the relevant non-DB tests in the same change as the implementation.
- Keep the first testing slices focused on pure server-side helpers and mocked orchestration that do not require external DB infrastructure; defer DB-backed or UI-heavy test work to later features.
- Treat coverage output from `npm run test` as part of the normal verification feedback, but do not enforce minimum thresholds in Feature 14.
- For secret-handling or browser/API exposure changes, follow the security test cadence in `docs/security/security.md`: run focused tests while implementing, then `docker compose exec web npm run typecheck`, `docker compose exec web npm run test`, and `docker compose exec web npm run build` before close-out.
- Before closing out a security-sensitive feature, use the security close-out checklist in `docs/security/security.md`.

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
- When the repository adds a standing process document such as `docs/security/security.md`, reference it from `README.md` and `AGENTS.md` so the workflow is discoverable.
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

Use this section for decisions that still actively shape current work.
Historical decisions are archived in [docs/decisions/decicions-log.md](/home/ads/git/watch-history/docs/decisions/decicions-log.md).

| Date       | Decision                                                                                     | Notes                                                                                                                                                           |
|------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-04-20 | Feature 15 is complete with security review and secret-exposure hardening close-out.   | Browser-visible paths, API responses, logs, client bundles, and build artifacts now keep sensitive configuration server-side and surface generic public errors. |
| 2026-04-20 | `docs/security/security.md` is the standing security-process reference.                | The repo now has a durable security playbook for secret handling, browser/API exposure review, logging hygiene, and secure development flow.                    |
| 2026-04-20 | Production build output review found no public source maps or browser bundle leaks.    | Secret-bearing env-var names appear only in server-only chunks; the static browser bundles and emitted build artifacts do not expose the sensitive values.      |

## Next Discovery Steps

1. Decide the next feature to spec if product work is ready to continue.
2. If Feature 14 needs more breadth, continue into any remaining DB-backed coverage slices after the non-DB importer and retention work completed here.
3. Decide whether day-of-week patterns and streak-style metrics belong in a Feature 12 follow-up pass or a later feature.

## Feature Progress

- Earlier feature completions are archived in [docs/architecture/README.md](/home/ads/git/watch-history/docs/architecture/README.md). This section keeps the most recent feature close-outs that are still likely to matter during active work.
- Feature 13: Complete
  A curation layer now lets the user favourite and hide individual timeline items, uses recommendation-oriented language in the curated experience, excludes hidden items from default timeline and analytics views, and recovers curated entries from a dedicated `/favourites` tab built on top of imported history.
- Feature 14: Complete
  The repository now has a container-first local automated testing workflow using `vitest`, text and HTML coverage output, helper-focused and mocked orchestration tests, importer and retention cleanup coverage, extracted-helper rewiring for analytics, and documented TDD expectations, with CI deferred to a later feature.
- Feature 15: Complete
  The security review hardened browser-visible routes, server actions, logs, client bundles, and build artifacts so sensitive configuration stays server-side and secret-bearing errors are surfaced with generic public messages.
