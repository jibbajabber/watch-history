# Feature 14: Testing And TDD Workflow

## Purpose

Add a real testing workflow to the project so features can be implemented and verified with repeatable automated checks inside the Docker-managed environment.

This feature should turn testing from an occasional manual step into a defined part of the repository workflow, ideally aligned with a TDD-style approach where practical.

## Product Goal

Make the codebase safer to change by introducing container-first automated tests, documenting how they should be used during feature work, and updating project workflow guidance so testing becomes a normal part of development rather than cleanup at the end.

## Scope

Included:
- choose and integrate a test stack appropriate for the current Next.js/PostgreSQL app
- define how tests run inside `docker compose`
- add initial coverage for core logic-heavy server-side modules
- document how agents and humans should add tests during feature work
- update repository workflow docs to encourage test-first or test-alongside-feature development
- define how database-backed tests should manage setup and teardown in containers

Excluded:
- full end-to-end browser automation
- broad coverage targets that are not yet realistic for the current codebase
- GitHub Actions and mandatory CI gating, which move to Feature 15 unless the user explicitly redirects this feature

## Problem Statement

The current repository can:
- typecheck
- build
- run in Docker

But it does not yet have a durable automated testing story:
- there is no standard test runner
- there are no repository-level test conventions
- AGENTS and README document build and Docker workflow, but not test expectations
- feature work is not yet guided toward writing tests before or alongside code

That leaves the project exposed to regressions in:
- importer logic
- query shaping
- source-health behavior
- timeline and analytics presentation assumptions

## Design Direction

### Docker-First Testing

Testing should follow the same project rule as the rest of the toolchain:
- tests run inside the Docker-managed environment
- host-local workflows should not become the primary path

That means the feature should define canonical commands such as:
- `docker compose exec web npm run test`
- `docker compose exec web npm run test:watch`
- `docker compose exec web npm run test -- --runInBand` only if the chosen stack needs a serialized DB-backed mode

The current Compose stack already provides the right baseline:
- `web` contains the app code and Node toolchain
- `db` provides the PostgreSQL service used by the app
- `worker` reuses the same image but is not the right default place to run tests

Feature 14 should therefore standardize on the `web` container as the default test entrypoint rather than inventing a parallel host-local workflow.

### Start With High-Value Server Logic

The first test investment should target code that is already complex and easy to regress:
- importer normalization logic
- retention and source-status derivation
- analytics query shaping or timeline grouping helpers
- server actions with well-bounded inputs and outputs

This is likely a better v1 target than jumping immediately to browser-heavy UI automation.

### TDD As Workflow Guidance, Not Dogma

The user explicitly wants TDD considered. Feature 14 should reflect that in the workflow docs.

Recommended repo stance:
- prefer test-first when adding new logic-heavy behavior
- at minimum, add or update tests in the same change as the code they protect
- bugs should normally begin with a failing test when the failure is practical to reproduce in the chosen test stack

This should be recorded in:
- `AGENTS.md`
- `README.md`
- any future contributor workflow docs

### CI Is Deferred To Feature 15

The current repo guidance already points to a smaller first milestone:
- settle local containerized testing first
- avoid broadening the feature into CI runtime, cache, and service-container concerns
- make sure the first suite is useful before deciding how to enforce it remotely

Planning decision for this feature:
- Feature 14 delivers the local/containerized workflow only
- Feature 15 will pick up GitHub Actions or other CI automation

## Candidate Test Layers

### Unit Tests

Strong initial candidates:
- formatting helpers
- source-retention parsing, serialization, and summary helpers
- source-status derivation helpers
- analytics and timeline response shaping helpers that do not require a live DB

### Integration Tests

Strong initial candidates:
- importer logic against sanitized real-world fixtures
- DB-backed query modules with a test database
- server actions or route handlers for curation, source settings, or analytics endpoints once they exist

### UI Tests

Possible but later:
- component rendering tests for timeline and analytics screens
- interaction tests for favourites/curation actions

These are valuable, but likely secondary to stabilizing server logic first.

## Tooling Direction

Feature 14 should explicitly evaluate and choose the test stack.

Chosen v1 candidate:
- `vitest` for TypeScript-friendly unit tests and narrow server-side integration tests

Possible companions:
- `@testing-library/react` for component tests
- `@testing-library/user-event` if interaction tests become useful
- a test database strategy using the existing Postgres container or a dedicated test database service

Selection criteria:
- works cleanly with the current Next.js and TypeScript setup
- runs well inside Docker
- supports incremental adoption
- does not require a large amount of framework-specific boilerplate to start

## Implementation Plan

### Phase 1: Test Architecture

- choose the test runner and first companion libraries
- define the Docker-native commands for running tests from the `web` container
- add the base config, scripts, and test file conventions
- decide how DB-backed tests will isolate state without making them the initial blocker

Exit criteria:
- the repository has a documented testing architecture and canonical containerized commands

### Phase 2: Initial Test Coverage

- add the base test config and scripts
- add a first set of high-value tests for current logic-heavy modules
- prove the setup works inside the Docker environment

Exit criteria:
- the repo has passing automated tests for at least one important existing feature area

### Phase 3: Workflow Documentation

- update `AGENTS.md` to require or strongly prefer tests in feature work
- update `README.md` with test commands and expectations
- document the intended TDD flow for new features and bug fixes

Exit criteria:
- contributors can discover how and when to write tests without tribal knowledge

### Phase 4: DB-Backed Follow-Up Guidance

- document the preferred approach for later DB-backed tests
- leave room for importer and route-level coverage once the base suite is stable
- record CI as the explicit next feature rather than an unresolved branch of this one

Exit criteria:
- the repository has a clear next-step plan for DB-backed coverage and Feature 15 CI work

## Acceptance Criteria

- the repository has a chosen test runner and documented test commands
- tests run inside the Docker-managed environment
- at least one meaningful logic-heavy area is covered by automated tests
- `AGENTS.md` and `README.md` document testing expectations and TDD guidance
- the feature leaves GitHub Actions explicitly deferred to Feature 15

## Implementation Status

Current state as of Saturday, 18 April 2026:
- `vitest` is installed and wired into `package.json`
- canonical Docker-first commands are `docker compose exec web npm run test`, `docker compose exec web npm run test:watch`, and `docker compose exec web npm run typecheck`
- `npm run test` runs with coverage enabled and writes both text and HTML output
- `vitest.config.ts` is present with path alias support and V8 coverage reporting
- `tsconfig.json` includes `vitest/globals`
- `Dockerfile` includes the test config and `tests/` directory so the container image knows about the automated suite

Verified helper extraction completed so far:
- `lib/source-status.ts`
- `lib/timeline-data.ts`
- `lib/analytics-data.ts`
- `lib/home-assistant-normalization.ts`
- `lib/plex-normalization.ts`

Production modules already rewired to extracted helpers:
- `lib/sources.ts` now uses `lib/source-status.ts`
- `lib/timeline.ts` now uses `lib/timeline-data.ts`

Production modules not yet rewired to their extracted pure helpers:
- `lib/analytics.ts` still contains its original shaping code even though `lib/analytics-data.ts` now exists
- `lib/home-assistant-import.ts` still contains its original normalization logic even though `lib/home-assistant-normalization.ts` now exists
- `lib/plex-import.ts` still contains its original normalization logic even though `lib/plex-normalization.ts` now exists

Current automated suite covers:
- formatting helpers
- source-status derivation helpers
- source-retention parsing and summary helpers
- timeline windowing, mapping, summary, insights, and highlights helpers
- analytics response-shaping helpers
- Home Assistant normalization helpers
- Plex normalization helpers

Last verified commands:
- `docker compose exec web npm run typecheck`
- `docker compose exec web npm run test`

Last verified results:
- `30` tests passed across `7` files
- overall coverage: `31.42%`
- `analytics-data.ts`: `98.41%`
- `timeline-data.ts`: `90.95%`
- `home-assistant-normalization.ts`: `97.72%`
- `plex-normalization.ts`: `92.16%`
- `format.ts`: `100%`
- `source-status.ts`: `58.21%`
- `source-retention.ts`: `32%`

Low-coverage or uncovered areas still left:
- `analytics.ts`
- `timeline.ts`
- `home-assistant-import.ts`
- `plex-import.ts`
- `sources.ts`
- `source-retention.ts`
- any DB-backed/query-heavy modules

## Resume Here

If work resumes in a new context window, pick up from this exact point:
- the Docker-first test workflow is implemented and working
- the repo already has the extracted pure helper modules listed above
- the suite is currently still helper-heavy rather than DB-heavy
- the best next move is to rewire the remaining production modules to consume their extracted helpers before adding DB-backed tests

Recommended next sequence:
1. Rewire `lib/analytics.ts` to use `lib/analytics-data.ts`.
2. Rewire `lib/home-assistant-import.ts` to use `lib/home-assistant-normalization.ts`.
3. Rewire `lib/plex-import.ts` to use `lib/plex-normalization.ts`.
4. Re-run `docker compose exec web npm run typecheck` and `docker compose exec web npm run test`.
5. Decide whether the next coverage slice should target:
   `lib/source-retention.ts` cleanup-path logic, or
   a first DB-backed test layer for `timeline.ts` / `analytics.ts`, or
   importer orchestration tests around persisted raw rows.

Recommended resume assumptions:
- keep GitHub Actions deferred to Feature 15
- keep browser/UI testing out of scope
- keep using helper extraction before introducing DB-heavy tests when practical
- do not add coverage thresholds yet

## Open Questions

- should the first test slice cover `lib/source-retention.ts` plus extracted source-status helpers, or should one importer module replace the source-status slice?
- should DB-backed tests use the existing `db` service with per-test cleanup, or a dedicated test database once the suite grows?
- is a small component-testing layer worth adding in this feature after the server-side suite lands, or should UI testing wait entirely for later work?
- do we want minimum coverage thresholds in v1, or should that wait until the suite is materially broader?

## Resume Defaults

If implementation resumes without fresh workflow clarification, use these defaults for v1:
- start with `vitest` as the test runner
- prioritize logic-heavy server-side coverage before component or browser-heavy testing
- first remaining targets should be rewiring `analytics`, Home Assistant import, and Plex import to the already-created helper modules, then choosing between `source-retention` cleanup logic and a first DB-backed slice
- run tests through the existing Docker-managed environment rather than host-local commands
- defer importer and DB-backed tests until the base `vitest` workflow is stable
- defer GitHub Actions into Feature 15
- avoid minimum coverage thresholds in the first testing milestone
