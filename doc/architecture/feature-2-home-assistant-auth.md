# Feature 2: Home Assistant Authentication

## Purpose

Add the first real source integration foundation by connecting the application to Home Assistant after the application shell and timeline views exist.

This feature establishes a supported authentication path to a Home Assistant instance so later source-specific watch-history ingestion can build on top of it.

## Product Goal

Allow the application to authenticate to Home Assistant securely and query entity/state history for later normalization into watch events.

## Constraints

- all tooling and runtime behavior must stay inside the Docker-managed environment
- secrets must come from environment variables provided to `docker compose` via an env file
- the application should use live imported data rather than mocked data as its normal mode
- raw imported records must be preserved before normalization

## Security Requirements

- credentials and tokens must be handled server-side
- secrets must not be embedded in frontend code or committed to source control
- import operations should be repeatable and auditable
- the initial implementation should prefer the simplest supported Home Assistant authentication mechanism that fits a personal Docker-hosted deployment

## Recommended Authentication Direction

Home Assistant exposes supported APIs over REST and WebSocket, and authenticates API clients with access tokens.

For this project, the pragmatic first implementation should use a Home Assistant long-lived access token supplied through the Docker Compose env file.

Why:
- it is officially supported by Home Assistant for API access
- it fits the existing env-file-based secret model for this repository
- it avoids adding browser auth complexity before the first ingestion path exists
- it is appropriate for a self-hosted personal deployment

Potential later enhancement:
- add the Home Assistant authorization-code flow if the product later needs interactive multi-user connection management

## Scope

Included:
- Home Assistant source configuration and env vars
- YAML-based non-secret source configuration for base URL and entity selection
- backend connectivity and authentication checks
- source status and connection reporting
- storage for Home Assistant source metadata required by later imports

Excluded:
- Sky Q-specific history ingestion
- frontend-hosted Home Assistant secrets
- unnecessary OAuth/browser auth complexity for the first integration milestone

## Recommended Delivery Plan

### Phase 1: Source Configuration

- define required Home Assistant env vars
- define the base URL, entity list, and access-token configuration model
- document the expected authentication method

Exit criteria:
- the application can validate that Home Assistant credentials are configured correctly
- the application can validate that the Home Assistant config file is present and valid

### Phase 2: Connectivity Check

- implement a backend connectivity check against Home Assistant
- verify the app can access the configured instance using the supplied token
- verify the configured entities exist
- capture useful failure states such as bad URL, bad token, or unavailable instance

Exit criteria:
- the application can report whether the Home Assistant source is reachable and authenticated

### Phase 3: Source Registration

- persist Home Assistant as a source in the database
- store source readiness and latest sync metadata
- expose source state in the application UI

## Acceptance Criteria

- Home Assistant credentials are supplied through env vars in the Docker Compose environment
- the application can validate connectivity to the Home Assistant instance
- Home Assistant appears as a first-class source in the product
- the groundwork is in place for a later entity-history import feature

## Risks

- Home Assistant instances may be deployed with self-signed certs or network restrictions that affect container connectivity
- token management needs to remain server-side and documented clearly
- entity history quality depends on the underlying Home Assistant recorder/history setup

## Open Questions

- should the first implementation support only long-lived access tokens, or also plan immediately for authorization-code auth?
- how should SSL verification and local-network connectivity be handled for self-hosted Home Assistant deployments?
- what exact source metadata should be persisted once a Home Assistant connection succeeds?
