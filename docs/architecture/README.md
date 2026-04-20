# Architecture Specs

This directory holds the review-first feature specs and architecture notes that shape development in this repository.

## Purpose

Use this area to understand:
- what each feature is trying to achieve
- which decisions were made before implementation
- where scope, assumptions, and open questions were recorded

These documents are the working bridge between product planning and code changes. A new feature should start here before implementation begins.

## How To Use This Directory

- Start with the feature file that matches the area you are working on.
- Use the spec to review scope and open questions before coding.
- Update the relevant spec when a feature direction becomes clearer or a significant implementation assumption is locked in.
- Keep this `README.md` current when new spec files are added or when the role of an existing spec changes enough that the table below would become stale.

## Feature Specs t

| Feature | File | Focus | Delivered                      | PR                                                           |
| --- | --- | --- |--------------------------------|--------------------------------------------------------------|
| Feature 1 | `feature-1-app-scaffold.md` | Initial Docker-first Next.js scaffold with weekly, monthly, and yearly timeline views. | —                              | —                                                            |
| Feature 2 | `feature-2-home-assistant-auth.md` | Home Assistant authentication and connectivity checks. | —                              | —                                                            |
| Feature 3 | `feature-3-home-assistant-skyq-history.md` | Sky Q watch-history ingestion from Home Assistant entities. | —                              | —                                                            |
| Feature 4 | `feature-4-ui-summaries-and-analytics.md` | Timeline summaries and analytics improvements on top of imported watch events. | —                              | —                                                            |
| Feature 5 | `feature-5-scheduled-home-assistant-sync.md` | Scheduled Home Assistant sync inside the Docker-managed environment. | - | -                                                            |
| Feature 6 | `feature-6-channel-logos.md` | Channel-logo discovery, mapping, and rendering for recognized channels. | Monday, 13 April 2026, 17:58   | [PR1](https://github.com/jibbajabber/watch-history/pull/1)   |
| Feature 7 | `feature-7-plex-source-support.md` | First Plex source integration with manual and scheduled imports. | Monday, 13 April 2026, 20:20   | [PR2](https://github.com/jibbajabber/watch-history/pull/2)   |
| Feature 8 | `feature-8-import-reliability-and-source-health.md` | Import resilience, worker hardening, source-health visibility, and warning-banner behaviour. | Monday, 13 April 2026, 21:20   | [PR3](https://github.com/jibbajabber/watch-history/pull/3)   |
| Feature 9 | `feature-9-home-assistant-current-playing-continuity.md` | Preserving Sky Q programme continuity when Home Assistant current-state detail advances without a matching playback-state transition. | Saturday, 18 April 2026, 14:09 | [PR4](https://github.com/jibbajabber/watch-history/pull/4)   |
| Feature 10 | `feature-10-plex-enrichment-and-sources-polish.md` | Plex durable-history rebuilding and operational `/sources` polish. | —                              | —                                                            |
| Feature 11 | `feature-11-source-data-retention-controls.md` | Per-source retention for raw data, normalized history, import jobs, and provisional source data. | —                              | —                                                            |
| Feature 12 | `feature-12-analytics-tab.md` | Dedicated analytics destination for watch patterns, dataset growth, and import activity. | —                              | —                                                            |
| Feature 13 | `feature-13-favourites-and-curation.md` | Favourites, hidden-item curation, and curated-history recovery. | Saturday, 18 April 2026, 18:30 | [PR8](https://github.com/jibbajabber/watch-history/pull/8)   |
| Feature 14 | `feature-14-testing-and-tdd-workflow.md` | Container-first automated testing workflow and TDD guidance. | Monday, 20 April 2026, 19:36   | [PR9](https://github.com/jibbajabber/watch-history/pull/9)   |
| Feature 15 | `feature-15-security-review.md` | Security review and secret-exposure hardening across browser-visible paths, API responses, logs, and build artifacts. | Monday, 20 April 2026, 20:46 | [PR10](https://github.com/jibbajabber/watch-history/pull/10) |

## Notes

- Filenames follow the `feature-<number>-<slug>.md` pattern.
- Keep specs additive where possible so the history of decisions remains traceable.
- When a scope is superseded or renumbered, update both the relevant spec and this index so contributors can still find the current source of truth quickly.
- Use the `Delivered` column for the implementation close-out timestamp when a feature has been completed, formatted like `Saturday, 18 April 2026, 18:30`.
- Use short PR labels in the `PR` column and link them to the real GitHub pull request when a feature has one.
