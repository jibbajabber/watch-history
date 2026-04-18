# Feature 13: Favourites And Curation

## Purpose

Let the user curate the timeline into a reusable recommendation set by marking watched items as favourites or recommended content, and by quickly dismissing low-value or accidental entries from the timeline.

This feature should build directly on the existing timeline and analytics work. The product already captures what was watched; Feature 13 should start capturing what was worth remembering or sharing.

## Product Goal

Turn passive watch history into an intentional curation workflow so the app can grow toward "recommend this to friends and family" rather than only "show me what happened."

## Scope

Included:
- a new top-level `Favourites` tab in the main app navigation
- a user action on timeline items that supports at least:
  - mark as favourite
  - mark as recommended
  - hide or purge the item from the visible timeline when it was only a momentary watch
- mobile-friendly press-and-hold interaction for timeline entries
- an equivalent desktop-friendly interaction that does not depend on long-press only
- persistence of user curation separate from raw imported source truth
- a first curated view that surfaces favourited and recommended items clearly

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

### User Curation Must Stay Separate From Source Truth

Feature 13 should not overwrite imported watch history semantics.

The source-first model still matters:
- raw imported evidence should remain intact by default
- normalized watch events should remain reproducible from source data
- user curation should sit alongside imported history, not silently rewrite it

That suggests a separate user-curation surface, likely backed by a new table such as:
- `UserCuratedItem`
- or a narrower v1 table such as `watch_event_feedback` / `watch_event_curation`

Candidate fields:
- `watch_event_id`
- `action` or booleans for `favourite`, `recommended`, `hidden`
- timestamps for when the curation action happened
- optional future room for notes or tags

### Multiple Hold Actions, Not A Single Toggle

The user's request already points to more than one useful outcome:
- favourite
- recommend
- purge from the visible timeline

So the interaction should open a small action sheet or contextual menu rather than only toggling a star.

On touch:
- long-press should open the action sheet

On desktop:
- a visible "more" affordance or context menu trigger should expose the same actions

This keeps the interaction discoverable and avoids shipping a mobile-only behavior.

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
- `Recommend`
- `Hide from timeline`
- `Undo` or `Clear curation`

Possible entry-state indicators:
- favourite badge or star
- recommended badge
- hidden items omitted from the main timeline by default

### Favourites Tab

Potential contents:
- favourited items grouped by most recently marked
- recommended items grouped separately or filterable within the same screen
- source and watched date context so curated items still connect back to real watch history

Possible v1 filters:
- all curated items
- favourites only
- recommended only

### Timeline Visibility Rules

V1 should answer clearly:
- hidden items should not appear in week, month, or year views by default
- favourites and recommendations should still appear in the timeline unless separately hidden
- analytics should probably exclude hidden items once the user has intentionally suppressed them

## Data Model Direction

Feature 13 likely needs a small schema migration.

Candidate v1 table:

```sql
CREATE TABLE watch_event_curation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_event_id UUID NOT NULL REFERENCES watch_events(id) ON DELETE CASCADE,
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watch_event_id)
);
```

Why this shape may be enough for v1:
- simple to query
- easy to expose in timeline and favourites UI
- easy to extend later with notes, tags, or recommendation context

Alternative:
- a richer `user_overrides` or `curated_media_items` model if we decide curation should attach to a title/media item rather than a specific watch event

Open design pressure:
- if the same title is watched multiple times, does recommending one watch event imply recommending the title globally?

V1 recommendation:
- keep curation attached to the watch event first
- add title-level promotion later only if real use shows the event-level model is too narrow

## Implementation Plan

### Phase 1: Curation Model

- define whether curation attaches to `watch_events` or a title-level abstraction
- define the first schema for favourite, recommended, and hidden states
- define how hidden items affect timeline and analytics queries

Exit criteria:
- the repository has a documented, source-safe curation model

### Phase 2: Timeline Interaction

- add an action trigger to timeline entries
- support long-press on touch devices
- support a desktop-friendly action entrypoint
- persist curation changes through server actions or equivalent app routes

Exit criteria:
- the user can mark an item as favourite, recommended, or hidden from the timeline

### Phase 3: Favourites View

- add a `Favourites` route and navigation tab
- render curated entries clearly
- support at least one useful filter between favourites and recommendations

Exit criteria:
- curated items are visible in a dedicated destination instead of being only metadata on timeline rows

### Phase 4: Query Integration

- update timeline queries to omit hidden items by default
- update analytics queries to define whether hidden items are excluded
- preserve enough traceability that curated items still link back to their watched context

Exit criteria:
- curation changes affect the user-facing product consistently without destroying source truth

## Acceptance Criteria

- the app has a dedicated `Favourites` tab
- a timeline item can be favourited, recommended, or hidden through a contextual action flow
- touch devices support a press-and-hold interaction
- desktop users have an accessible equivalent interaction
- hidden items no longer appear in default timeline views
- favourites and recommendations persist across reloads and imports
- source data remains preserved even when an item is hidden from the timeline

## Open Questions

- should favourites and recommendations be separate states, or should recommendation imply favourite?
- should hidden items be recoverable from the UI in v1, and if so where?
- should curation attach to individual watch events or promote to a title-level concept when titles repeat?
- should analytics exclude hidden items immediately, or should curation remain a purely presentation-layer concern at first?
- do we need notes or a short "why recommend this" field in v1, or is that a later feature?

## Resume Defaults

If implementation resumes without fresh product clarification, use these defaults for v1:
- attach curation to individual `watch_events`, not title-level media
- keep `favourite` and `recommended` as separate states
- treat "purge from timeline" as reversible hide/suppress behavior, not source-data deletion
- exclude hidden items from default timeline views and analytics queries
- defer notes or recommendation commentary to a later feature
