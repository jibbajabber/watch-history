# Watch History

This repository is for planning and building a web application that aggregates watch history from multiple media sources into a unified timeline.

![Watch History main screen](public/static/watch-history-main.png)

## Documentation Role

`README.md` is the primary human-facing overview of the repository. As the project evolves, it should explain:
- how the project is structured
- what each major file or directory is for
- how to run or develop the application
- any important architectural conventions

## Current Structure

- `AGENTS.md`: Working project-definition document, collaboration guidance, engineering standards, and decision log.
- `app/`: Next.js App Router entrypoints, API routes, and global styles for the web application.
- `components/`: UI components for the application shell and timeline views.
- `components/timeline/channel-logo.tsx`: Compact channel-logo renderer for timeline entries.
- `configs/home-assistant-ca.crt.example`: Example placeholder for an optional Home Assistant CA certificate file when using a private CA.
- `configs/home-assistant.yaml.example`: Example non-secret Home Assistant source configuration for the base URL and tracked entity IDs.
- `configs/plex.yaml.example`: Example non-secret Plex sync configuration for the worker interval and enabled state.
- `db/init/`: PostgreSQL initialization scripts for the first application schema.
- `docs/architecture/feature-1-app-scaffold.md`: Review-first implementation plan for the application scaffold and weekly, monthly, and yearly views.
- `docs/architecture/feature-2-home-assistant-auth.md`: Review-first implementation plan for Home Assistant authentication.
- `docs/architecture/feature-3-home-assistant-skyq-history.md`: Review-first implementation plan for pulling Sky Q watch history from Home Assistant entities.
- `docs/architecture/feature-4-ui-summaries-and-analytics.md`: Review-first implementation plan for richer timeline summaries and analytics.
- `docs/architecture/feature-5-scheduled-home-assistant-sync.md`: Review-first implementation plan for scheduled Home Assistant sync.
- `docs/architecture/feature-6-channel-logos.md`: Review-first implementation plan for channel-logo discovery and rendering.
- `docs/architecture/feature-7-plex-source-support.md`: Review-first implementation plan for the first Plex source integration.
- `docs/architecture/feature-8-import-reliability-and-source-health.md`: Review-first implementation plan for resilient import failures, source-health status, and shared warning banners.
- `docs/architecture/feature-9-plex-enrichment-and-sources-polish.md`: Review-first implementation plan for Plex playback enrichment and `/sources` UI cleanup.
- `lib/`: Server-side data access, formatting, and shared type definitions.
- `lib/channels.ts`: Channel normalization and local logo-registry mapping for Sky Q channel branding.
- `lib/plex.ts`: Plex connectivity and API helpers for token-based server access.
- `lib/plex-import.ts`: Plex raw history import and watch-event normalization from `/status/sessions/history/all`, supplemented by current `/status/sessions` playback when available.
- `lib/plex-config.ts`: Plex non-secret scheduled sync configuration loader/writer.
- `public/channel-logos/`: Curated local SVG channel logo assets for recognized channels.
- `scripts/source-sync-worker.ts`: Scheduled source sync worker for Docker Compose, currently handling Home Assistant and Plex.
- `Dockerfile`: Canonical application container definition for local development.
- `docker-compose.yml`: Container orchestration for the web application and PostgreSQL database.
- `.env.example`: Required environment variables for the Docker Compose environment.
- `README.md`: Repository overview and high-level documentation index.

## Current Status

The current application is a working first version:
- Next.js provides the web app and server-side routes
- PostgreSQL stores sources, import jobs, raw records, and normalized watch events
- week, month, and year timeline views are live
- Home Assistant authentication and Sky Q history import are working
- Plex source registration, connectivity checks, manual history import, and scheduled sync are available
- Plex imports supplement durable history with active sessions so in-progress playback can appear before Plex writes a history row
- scheduled sync is available through Docker Compose
- the UI uses live imported data rather than mocked watch-history content

Current planning is organized as feature-specific architecture documents under `docs/architecture`.
Feature 6 is complete: recognized channels and platform brands are normalized through `lib/channels.ts`, mapped to curated SVG assets in `public/channel-logos/`, and rendered in timeline rows with text fallback for unmapped labels.

## Progress And TODO

Completed:
- Feature 1: Docker-first app scaffold with week, month, and year views
- Feature 2: Home Assistant authentication and connectivity
- Feature 3: Sky Q history import from Home Assistant entities
- Feature 4: Timeline summaries, analytics, and improved activity overview
- Feature 5: Scheduled Home Assistant sync with editable interval and overlap protection
- Feature 6: Channel and platform branding with a curated local registry and timeline-row rendering

Completed:
- Feature 7: Plex source support with env-based connectivity, manual history import, active-session enrichment, and scheduled sync

Recommended next pickup:
1. Implement feature 8 around reliability improvements and source-health visibility
2. Reserve feature 9 for Plex device/progress enrichment and `/sources` page polish
3. Confirm whether any additional source priorities should follow Plex

## Development Workflow

The supported development workflow runs inside Docker.

1. Create `.env` from `.env.example`.
2. Create `configs/home-assistant.yaml` from `configs/home-assistant.yaml.example`.
3. Add your Home Assistant token to `.env`.
4. Start the stack with `docker compose up --build`.
5. Open `http://localhost:3000`.

Do not run the application stack directly on the host machine. Docker and `docker compose` are the intended execution environment.

## Environment Variables

These variables are required by the Compose environment:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `APP_URL`
- `APP_INTERNAL_URL`
- `APP_TIMEZONE`

These variables are reserved for the Home Assistant integration flow:
- `HOME_ASSISTANT_ACCESS_TOKEN`

These variables are reserved for the planned Plex integration flow:
- `PLEX_BASE_URL`
- `PLEX_TOKEN`

`DATABASE_URL` should be derived from the Postgres settings, for example:

```env
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
```

Secrets for future external integrations should follow the same pattern: define variable names in documentation, provide real values through the env file, and inject them into the Docker Compose environment.

For Home Assistant, the current plan is to keep the non-secret base URL and tracked entity IDs in YAML, and supply the long-lived access token through the env file so the application can authenticate server-side and query entity history through the supported APIs.

`APP_TIMEZONE` controls how timestamps are rendered and how timeline groupings are labeled in the application. For a UK deployment, use:

```env
APP_TIMEZONE=Europe/London
```

`APP_INTERNAL_URL` is used by the scheduled sync worker to call the app from inside Docker Compose. The default is:

```env
APP_INTERNAL_URL=http://web:3000
```

## Home Assistant Import

The first Sky Q ingestion path is manual from the `/sources` page.

When you trigger the import, the app:
- calls Home Assistant's `/api/history/period/<timestamp>` endpoint for the configured entities
- supplements the historical data with the current entity state when needed
- preserves raw state-history records in `raw_import_records`
- rebuilds normalized Sky Q watch sessions into `watch_events`
- makes those events available in the week, month, and year views

The current import window is the last 365 days.
Repeated imports are intended to be idempotent at the normalized timeline layer: raw source records are upserted, and Home Assistant-derived watch events are rebuilt from the imported history instead of blindly appended.
Manual and scheduled imports are protected against overlap so the same source cannot be imported twice at the same time.

Normalization notes:
- generic device-only rows such as `Sky Q Bedroom` or `Sky Q Livingroom` are filtered out unless Home Assistant exposes meaningful programme metadata
- real timeline entries preserve channel/source context and device context separately
- current entity state is merged into import processing so currently playing content can appear even when history has not yet emitted a fresh transition
- recognized channels now persist a high-confidence `metadata.channel_key` when matched by the local registry, while unknown channels remain text-only

## Scheduled Sync

Source sync can also run automatically inside Docker Compose.

- the `worker` service reads `configs/home-assistant.yaml` and `configs/plex.yaml`
- it checks each source's `sync.enabled` and `sync.interval_minutes`
- when enabled, it triggers the same import path used by the manual import button
- repeated scheduled imports are intended to remain idempotent
- scheduled and manual imports share the same overlap protection for each source

You can manage the sync interval from the `/sources` page, and the setting is written back to the relevant source config file.
The `/sources` page also shows the current status, saved interval, and next automatic run for each source.

## Home Assistant Configuration

Home Assistant uses two configuration surfaces:
- secrets go in `.env`
- non-secret source settings go in `configs/home-assistant.yaml`

Example `configs/home-assistant.yaml`:

```yaml
base_url: "http://homeassistant.local:8123"
entities:
  - "media_player.sky_q_livingroom"
  - "media_player.sky_q_bedroom"
sync:
  enabled: false
  interval_minutes: 30
```

`base_url` is intentionally stored in YAML because it is not sensitive. The access token must stay in `.env`.
The `sync` section is also non-sensitive and controls the scheduled Home Assistant import worker.

Plex follows a similar split:
- secrets and connection details go in `.env`
- non-secret scheduled sync settings go in `configs/plex.yaml`

Example `configs/plex.yaml`:

```yaml
sync:
  enabled: false
  interval_minutes: 30
```

`PLEX_BASE_URL` and `PLEX_TOKEN` stay in `.env`, while the Plex worker schedule stays in `configs/plex.yaml`.

If your Home Assistant instance uses a certificate signed by a private or self-signed CA, also copy `configs/home-assistant-ca.crt.example` to `configs/home-assistant-ca.crt` and paste the PEM-encoded CA certificate there. The app will use that CA file when calling Home Assistant without disabling TLS verification.

## How To Get A Home Assistant Token

Use a long-lived access token from your Home Assistant profile.

1. Sign in to Home Assistant in your browser.
2. Open your profile page.
3. Scroll to `Long-Lived Access Tokens`.
4. Create a new token and copy it immediately.
5. Put that value in `.env` as `HOME_ASSISTANT_ACCESS_TOKEN`.

The official Home Assistant REST API docs describe this token flow and the required bearer-token header:
- https://developers.home-assistant.io/docs/api/rest

## How To Get A Plex Token

The planned Plex integration will use an `X-Plex-Token` supplied through `.env`.

Based on Plex's support guidance, the practical retrieval flow is:

1. Sign in to Plex Web App in your browser.
2. Open a library item.
3. Open that item's XML view.
4. Look in the URL for the `X-Plex-Token` query parameter.
5. Copy the token value into `.env` as `PLEX_TOKEN`.

You will also need the base URL for your Plex Media Server, which should be stored as `PLEX_BASE_URL`.

Official references:
- https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
- https://support.plex.tv/articles/201638786-plex-media-server-url-commands/

## Home Assistant Source Files

- `configs/home-assistant-ca.crt.example` is the committed example for an optional CA certificate.
- `configs/home-assistant-ca.crt` is the real local CA file and is ignored by git.
- `configs/home-assistant.yaml.example` is the committed example file.
- `configs/home-assistant.yaml` is the real local config file and is ignored by git.
- `configs/plex.yaml.example` is the committed example file for Plex scheduled sync.
- `configs/plex.yaml` is the real local Plex sync config file and is ignored by git.
- `.env.example` documents the token variable name, but real tokens must only live in your local `.env`.

## Useful Validation

To validate the running application:

1. Open `/sources`
2. Confirm Home Assistant is connected
3. Trigger a manual import or wait for the next scheduled run
4. Confirm `Latest import` updates
5. Check `/week` for fresh timeline entries and durations

To validate scheduled sync behavior:

```bash
docker compose logs -f worker
```

The worker logs:
- startup
- skipped ticks and why for each source
- scheduled sync triggers
- scheduled sync completion
