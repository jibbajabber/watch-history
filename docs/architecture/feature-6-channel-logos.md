# Feature 6: Channel Logos

## Purpose

Add channel logos to the application so timeline entries and summaries are easier to scan visually.

This feature should improve recognition and reduce reliance on raw channel text such as `BBC One Lon HD` or `SkyAdventureHD`.

## Product Goal

Show recognizable channel or platform branding alongside imported watch events and source summaries where a stable identity can be determined.

## Important Discovery Requirement

Do not jump straight to rendering logos based on ad hoc string matching.

This feature needs an explicit discovery phase first to answer:
- which Home Assistant attributes are stable enough to identify a channel reliably
- whether those identifiers are consistent across Sky Q entities and imports
- where logos should come from
- whether logo assets can be stored locally, mapped manually, or resolved from a trusted source

The implementation should not assume that:
- `media_title` alone is always a reliable channel key
- channel names are consistent enough to match logos without normalization
- external logo sources are acceptable without a review of quality, licensing, and stability

## Initial Discovery Findings

Initial discovery has been completed against the current importer and timeline model, not against a new live-data sample yet.

What the code currently gives us:
- `watch_events.metadata.attributes` preserves the raw Home Assistant attribute payload for each normalized session
- `watch_events.metadata.channel` stores the importer-derived channel text
- the importer can now prefer `media_channel`, then `channel`, then `channel_name`, then `media_title` when deriving channel identity
- recognized channels can persist `watch_events.metadata.channel_key` without a schema migration

Current implication:
- the feature can start without changing the database schema
- real-data validation is still needed to expand the registry and confirm additional Sky Q variants

## Scope

Included:
- discovery and documentation of stable channel identifiers
- design of a channel-logo mapping strategy
- UI support for showing channel logos on timeline entries and related summaries
- graceful fallback when no logo is known

Excluded:
- unrelated metadata enrichment
- speculative live lookups against unstable or undocumented third-party endpoints
- logo usage without reviewing asset provenance and maintenance approach

## Discovery Phase

### Data Discovery

- inspect imported Home Assistant raw records and normalized watch events
- determine which fields are present and stable:
  - `media_title`
  - `media_channel`
  - `source`
  - channel number fields
  - any other relevant attributes exposed by Sky Q
- document normalization issues such as `BBC One Lon HD` vs `BBC One`

### Asset Strategy Discovery

Decide which of these strategies is appropriate:
- commit a local curated set of logo assets and maintain a mapping table
- fetch and cache from a trusted source with acceptable usage terms
- support a hybrid approach with curated local overrides

This decision should be documented before implementation proceeds.

## Design Direction

Prefer a simple and durable approach:
- normalize channel identifiers into a canonical internal key
- allow platform/app brands in the same badge system when Home Assistant clearly reports app usage rather than a live channel
- map canonical keys to known logo assets
- render logos only when confidence is high
- fall back cleanly to text when no mapping exists

For an initial version, a curated local mapping is likely the safest path.

This initial implementation chooses that path:
- commit a curated local set of SVG channel marks under `public/channel-logos/`
- map stable canonical keys in `lib/channels.ts`
- render logos only for recognized keys
- fall back to text for everything else

The initial SVG set is intentionally repo-local and static so the app does not depend on external runtime logo lookups.

## Potential Implementation Shape

### Data Layer

- define a channel normalization helper
- define a channel-logo registry or mapping file
- optionally persist canonical channel keys in normalized watch-event metadata during import

### UI Layer

- show a compact channel logo beside or instead of the raw channel text where appropriate
- preserve accessibility with text labels and alt text
- avoid layout shifts when logos are missing

### Asset Layer

- add a local directory for channel logo assets if local logos are chosen
- document the source and maintenance expectations for those assets

## Acceptance Criteria

- the team has documented which channel identifiers are reliable enough to use
- the logo source strategy is explicitly chosen and documented
- timeline entries can show channel logos when a stable mapping exists
- unknown or unmapped channels fall back to clean text rendering
- the app remains usable even when no logo is available

## Initial Implementation Notes

The first implementation layer now exists:
- `lib/channels.ts` defines channel aliases, canonical keys, and asset paths
- `lib/home-assistant-import.ts` persists a high-confidence `channel_key` for recognized channels
- `lib/timeline.ts` resolves channel branding for both new and older rows
- `components/timeline/timeline-grid.tsx` renders logos in timeline rows when a mapping exists

Current normalization policy includes:
- HD and similar transport suffixes may normalize into a cleaner canonical brand, for example `Sky Action HD` to `Sky Action`
- app/platform entries such as `BBC iPlayer` and `HBO Max` may render branded badges when the imported attributes clearly identify them as apps
- awkward Sky Q labels may normalize to a clearer parent brand when the identity is unambiguous, for example `Disney+CineHD` to `Disney+`

Remaining follow-up work:
- validate real imported channel variants from Home Assistant history
- widen the curated registry beyond the initial BBC, ITV, Channel 4/5, and Sky entries
- decide whether highlights or summary surfaces should also adopt channel branding

## Open Questions

- which Home Assistant fields are the most stable identifiers for Sky Q channels?
- do HD/SD/regional variants need separate logos or normalization into a shared channel identity?
- should logos appear only in timeline rows, or also in summaries and highlights?
- what is the acceptable source of truth for logo assets?
