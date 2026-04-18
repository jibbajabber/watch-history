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
- add initial coverage for core server-side logic and at least one user-facing workflow
- document how agents and humans should add tests during feature work
- update repository workflow docs to encourage test-first or test-alongside-feature development
- define how database-backed tests should manage setup and teardown in containers

Excluded:
- full end-to-end browser automation unless the chosen first test stack makes a thin slice practical
- broad coverage targets that are not yet realistic for the current codebase
- mandatory CI gating unless GitHub Actions is explicitly included in scope

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
- `docker compose exec web npm test`
- `docker compose exec web npm run test:watch`
- possibly a separate one-off service or ephemeral database if needed

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

### GitHub Actions May Be Part Of Feature 14 Or Feature 15

GitHub Actions support is related, but it may be a separate delivery slice.

Why it may deserve its own feature:
- local containerized testing and repository test architecture should be settled first
- CI introduces separate concerns: runtime, cache strategy, secrets, service containers, and required checks

Planning recommendation:
- Feature 14 should at minimum define the local/containerized test workflow
- GitHub Actions can either be a final phase of Feature 14 or split into Feature 15 if the implementation grows meaningfully beyond local test integration

## Candidate Test Layers

### Unit Tests

Strong initial candidates:
- formatting helpers
- source-retention summaries and cleanup selection
- source-status derivation
- analytics and timeline response shaping helpers that do not require a live DB

### Integration Tests

Strong initial candidates:
- importer logic against sanitized real-world fixtures
- DB-backed query modules with a test database
- server actions or route handlers for curation, source settings, or analytics endpoints once they exist

### UI Tests

Possible but probably later:
- component rendering tests for timeline and analytics screens
- interaction tests for future favourites/curation actions

These are valuable, but likely secondary to stabilizing server logic first.

## Tooling Direction

Feature 14 should explicitly evaluate and choose the test stack.

Likely candidate:
- `vitest` for TypeScript-friendly unit and integration tests

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
- define the Docker-native commands for running tests
- define how DB-backed tests will isolate state
- decide whether sanitized fixtures are needed for importer tests

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

### Phase 4: CI Decision

- decide whether GitHub Actions belongs in this feature or should be split into Feature 15
- if kept in scope, add a minimal CI workflow that runs the canonical containerized checks

Exit criteria:
- the repository has a clear plan for automated remote verification, whether implemented now or explicitly deferred

## Acceptance Criteria

- the repository has a chosen test runner and documented test commands
- tests run inside the Docker-managed environment
- at least one meaningful logic-heavy area is covered by automated tests
- `AGENTS.md` and `README.md` document testing expectations and TDD guidance
- the feature leaves a clear decision on whether GitHub Actions is part of this feature or the next one

## Open Questions

- should the first tests focus on importer logic, analytics/timeline queries, or source-status/retention behavior?
- should DB-backed tests use the existing app database container, a separate test database, or transactional isolation in one schema?
- how much component-level testing is worth doing before the curation/favourites UI lands?
- should GitHub Actions ship as Feature 14 Phase 4, or should that become Feature 15 after the local test workflow is stable?
- do we want minimum coverage thresholds in v1, or should that wait until the suite is less sparse?

## Resume Defaults

If implementation resumes without fresh workflow clarification, use these defaults for v1:
- start with `vitest` as the test runner
- prioritize logic-heavy server-side coverage before component or browser-heavy testing
- first test targets should be source-status/retention helpers plus one importer or analytics query-shaping slice
- run tests through the existing Docker-managed environment rather than host-local commands
- defer GitHub Actions into Feature 15 unless the local/containerized test workflow lands with clear spare capacity
- avoid minimum coverage thresholds in the first testing milestone
