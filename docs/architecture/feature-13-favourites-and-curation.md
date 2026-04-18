# Feature 13: Favourites And Curation

## Purpose

Let the user curate the timeline into a reusable recommendation set by marking watched items as favourites or recommended content, and by quickly dismissing low-value or accidental entries from the timeline.

This feature should build directly on the existing timeline and analytics work. The product already captures what was watched; Feature 13 should start capturing what was worth remembering or sharing.

## Product Goal

Turn passive watch history into an intentional curation workflow so the app can grow toward "recommend this to friends and family" rather than only "show me what happened."

## Scope

Included:
- a new top-level `/favourites` tab in the main app navigation
- event-level curation attached to existing `watch_events`
- a user action on timeline items that supports at least:
  - mark as favourite
  - use recommendation-oriented wording in the action or related UI copy when it helps explain that favourites are the items worth recommending later
  - hide the item from default timeline and analytics views when it was only a momentary or low-value watch
- mobile-friendly press-and-hold interaction for timeline entries
- an equivalent desktop-friendly interaction that does not depend on long-press only
- persistence of user curation separate from raw imported source truth
- a first curated view that surfaces favourited items clearly and frames them as the watch history worth recommending later
- a recoverable path for hidden items so suppression is reversible in the UI

Excluded:
- social sharing or external recommendation publishing
- ratings, reviews, tags, notes, or freeform commentary unless implementation evidence shows one simple text field is necessary in v1
- automatic recommendation scoring
- source-import changes
- irreversible destructive deletion of raw source rows in v1

## Problem Statement

The app currently answers:
- what was watched
- when it was watched
- which source contributed it

It does not yet answer:
- which of those items mattered
- which ones should be recommended later
- which entries should be ignored because they were accidental, transient, or not meaningful content

Without that layer, the product can show historical activity but cannot yet help the user build a trustworthy recommendation memory over time.

## Design Direction

### Repository-Fit V1 Slice

The current application already has:
- top-level navigation in `components/app-shell.tsx`
- timeline rendering in `components/timeline/timeline-grid.tsx`
- timeline queries in `lib/timeline.ts`
- analytics queries in `lib/analytics.ts`
- shared type surfaces in `lib/types.ts`
- an initial schema bootstrapped from `db/init/001_initial.sql`

Feature 13 should fit that shape rather than introducing a parallel architecture.

Concrete v1 target:
- add a `watch_event_curation` table keyed one-to-one to `watch_events`
- expose curation through server-side app actions or route handlers in the existing App Router style
- enrich timeline event types with curation flags so the timeline and favourites screens can render directly from query results
- add a dedicated `app/favourites/page.tsx` entrypoint and a focused screen component instead of overloading the analytics or timeline routes
- keep imports and source normalization unchanged; curation consumes normalized watch events after import

### User Curation Must Stay Separate From Source Truth

Feature 13 should not overwrite imported watch history semantics.

The source-first model still matters:
- raw imported evidence should remain intact by default
- normalized watch events should remain reproducible from source data
- user curation should sit alongside imported history, not silently rewrite it

That suggests a separate user-curation surface, likely backed by a narrow v1 table such as `watch_event_curation`.

Candidate fields:
- `watch_event_id`
- booleans for `is_favourite`, `is_hidden`
- timestamps for when the curation action happened
- optional future room for notes or tags

### Multiple Hold Actions, Not A Single Toggle

The user's request already points to more than one useful outcome:
- favourite
- purge from the visible timeline

So the interaction should open a small action sheet or contextual menu rather than only toggling a star.

On touch:
- long-press should open the action sheet

On desktop:
- a visible "more" affordance or context menu trigger should expose the same actions

This keeps the interaction discoverable and avoids shipping a mobile-only behavior.

V1 implementation preference:
- each timeline row gets a compact visible trigger on desktop
- touch devices can open the same menu with long-press, but long-press is additive rather than the only path
- keyboard users should be able to reach the same actions with a normal button/menu pattern

### Purge Means Curated Hiding First, Not Data Destruction

"Purge from timeline" is useful, but v1 should treat this as a user-level hide or suppress action rather than deletion of source data.

Why:
- imported source truth is a core project principle
- accidental watches are still part of raw history evidence
- actual deletion creates more risk around rebuilds, retention, and auditability

V1 semantics should likely be:
- hidden items stop appearing in the default timeline and analytics surfaces where appropriate
- the underlying source rows remain stored
- the hide action can be reversed

If hard deletion is ever needed later, it should be a separate feature with stronger safeguards.

## Candidate UX Changes

### Timeline Entry Actions

Potential actions for each watch event:
- `Favourite`
- `Hide from timeline`
- `Undo` or `Clear curation`

Possible entry-state indicators:
- favourite badge or star
- hidden items omitted from the main timeline by default

### Favourites Tab

Potential contents:
- favourited items grouped by most recently curated or watched
- recommendation-oriented supporting copy that explains this is the place to revisit what was worth keeping or recommending
- an optional hidden filter so suppressed items remain recoverable without reappearing in the default timeline
- source and watched date context so curated items still connect back to real watch history

Possible v1 filters:
- all curated items
- favourites only
- hidden only

### Timeline Visibility Rules

V1 should answer clearly:
- hidden items should not appear in week, month, or year views by default
- favourites should still appear in the timeline unless separately hidden
- analytics should probably exclude hidden items once the user has intentionally suppressed them
- the favourites view should be able to surface hidden curated items when the user explicitly asks for them

## Data Model Direction

Feature 13 needs a small schema migration.

Candidate v1 table:

```sql
CREATE TABLE watch_event_curation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_event_id UUID NOT NULL REFERENCES watch_events(id) ON DELETE CASCADE,
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watch_event_id)
);
```

Why this shape may be enough for v1:
- simple to query
- easy to expose in timeline and favourites UI
- easy to extend later with notes, tags, or richer recommendation context
- matches the current single-user product direction without inventing a multi-user abstraction too early

Alternative:
- a richer `user_overrides` or `curated_media_items` model if we decide curation should attach to a title/media item rather than a specific watch event

Open design pressure:
- if the same title is watched multiple times, does recommending one watch event imply recommending the title globally?

V1 recommendation:
- keep curation attached to the watch event first
- add title-level promotion later only if real use shows the event-level model is too narrow

Suggested query effect:
- `lib/timeline.ts` should left join curation state and exclude `is_hidden = TRUE`
- `lib/analytics.ts` should exclude hidden events from user-facing totals and rankings
- the favourites query should include hidden items only when its filter explicitly asks for them

Suggested type effect:
- extend `TimelineEvent` with curation fields needed by the row UI
- add a dedicated favourites response type rather than overloading `AnalyticsResponse`

Suggested route/component shape:
- `app/favourites/page.tsx`
- `components/favourites-screen.tsx`
- `lib/curation.ts`
- either `app/favourites/actions.ts` or a curation-focused API route if the server-action path becomes awkward

## Implementation Plan

### Phase 1: Schema And Query Surface

- add `watch_event_curation` to the schema and document the migration shape
- define the read/write helpers that attach curation to `watch_events`
- define how hidden items affect timeline and analytics queries

Exit criteria:
- the repository has a documented, source-safe curation model that fits the current schema and query layout

### Phase 2: Timeline Actions

- add an action trigger to timeline entries
- support long-press on touch devices
- support a desktop-friendly action entrypoint
- persist curation changes through server actions or equivalent App Router endpoints
- render clear row indicators for favourite state, with recommendation-oriented copy where it improves clarity

Exit criteria:
- the user can mark an item as favourite or hidden from the timeline and see the state reflected on the row

### Phase 3: Favourites Destination

- add a `Favourites` route and navigation tab
- render curated entries clearly
- support at least these filters: all curated items, favourites, hidden
- allow hidden entries to be unhidden from this screen

Exit criteria:
- curated items are visible in a dedicated destination instead of being only metadata on timeline rows

### Phase 4: Product Integration

- update timeline queries to omit hidden items by default
- update analytics queries to exclude hidden items
- preserve enough traceability that curated items still link back to their watched context
- confirm import rebuilds do not discard curation because the relationship is anchored to durable `watch_events`

Exit criteria:
- curation changes affect the user-facing product consistently without destroying source truth

## Acceptance Criteria

- the app has a dedicated `Favourites` tab
- a timeline item can be favourited or hidden through a contextual action flow
- touch devices support a press-and-hold interaction
- desktop users have an accessible equivalent interaction
- hidden items no longer appear in default timeline views
- hidden items no longer affect default analytics totals and rankings
- hidden items can be recovered through the UI
- favourites persist across reloads and imports
- source data remains preserved even when an item is hidden from the timeline

## Open Questions

- should curation attach to individual watch events or promote to a title-level concept when titles repeat?
- do we need notes or a short "why recommend this" field in v1, or is that a later feature?
- should the favourites list sort by curated-at timestamp, watched-at timestamp, or a blend of both in v1?
- does the current schema need an explicit `updated_at` trigger pattern elsewhere before we introduce the first mutable user-owned table?

## Resume Defaults

If implementation resumes without fresh product clarification, use these defaults for v1:
- attach curation to individual `watch_events`, not title-level media
- use a single `favourite` state and treat recommendation as supporting UX language rather than a separate stored flag
- treat "purge from timeline" as reversible hide/suppress behavior, not source-data deletion
- exclude hidden items from default timeline views and analytics queries
- make hidden items recoverable from the dedicated favourites screen
- add a visible desktop action trigger and treat long-press as an additional touch affordance, not the only interaction
- defer notes or recommendation commentary to a later feature
