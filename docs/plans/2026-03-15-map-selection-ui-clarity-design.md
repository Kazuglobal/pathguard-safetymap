# Map Selection UI Clarity Design

**Date:** 2026-03-15

## Problem

The current map screen mixes action buttons and display toggles across overlapping floating surfaces. On mobile, users can see `一覧`, `現在地`, `危険を報告`, and map display controls at nearly the same visual level, which makes it harder to tell which button should be pressed first.

The user wants to improve the UI inside the map selection experience with a priority on clarity of action. The main issue to solve is:

- Users hesitate because it is not obvious which button they should press.

The provided screenshots also show a second issue:

- The display selection UI relies too much on image tiles and border color, so the meaning of each option and the current state are not obvious enough.

## Goals

- Make the primary map actions immediately scannable on mobile.
- Separate `doing something on the map` from `changing what the map shows`.
- Clarify which action is primary, secondary, and supporting.
- Make display options understandable without relying on visuals alone.
- Preserve existing reporting, GPS, and map-style behavior where possible.

## Non-goals

- Rewriting map business logic, data fetching, or report submission.
- Replacing the existing map provider or changing map rendering architecture.
- Redesigning unrelated desktop-only map tools beyond what is required for consistency.
- Introducing a large new navigation model for the rest of the app.

## Chosen Approach

Split the mobile map UI into two clearly different control zones:

- `操作` zone: a bottom action dock for `一覧`, `現在地`, and `報告`
- `表示` zone: a dedicated display sheet opened from an explicit `表示` trigger

This removes the current ambiguity where actions and display settings appear as peers. Users should be able to infer:

- If they want to do something, use the bottom action dock.
- If they want to change what the map looks like, open `表示`.

## Why This Approach

- It solves the actual confusion problem, not just the cosmetics.
- It keeps the most important action, reporting, visible and dominant.
- It gives map display settings a clear home instead of leaving them as a small ambiguous control.
- It can reuse the existing state and callbacks in [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx) and related map components.

## Information Architecture

### Action Zone

The bottom dock is reserved for direct map actions only.

- `一覧`: supporting action, opens the hazard list/sidebar
- `現在地`: secondary action, centers the report flow around current location
- `報告`: primary action, starts reporting

These actions should remain available in a consistent order and visual hierarchy.

### Display Zone

Display-related controls move behind an explicit `表示` entry point.

The sheet is divided into two groups:

1. `地図の見た目`
2. `地図に重ねる情報`

This lets users distinguish between changing the base map and toggling overlays.

## Interaction Model

### Bottom Action Dock

The dock keeps a three-part layout but strengthens visual hierarchy:

- `報告` is the primary filled CTA
- `現在地` is a lighter emphasized secondary CTA
- `一覧` is a neutral supporting button

The accessible names for existing actions should remain stable where possible, especially for current tests:

- `危険箇所を報告する`
- `現在地で報告`
- `危険地点一覧を開く`

### Action States

When the user enters a focused reporting state, the dock should stop behaving like a normal three-action launcher.

- During `地点選択中`, the primary control should communicate selection status rather than competing with unrelated actions.
- During `報告入力中`, the dock should reduce competing actions so the user is not asked to make a fresh decision.
- During GPS acquisition, `現在地` should clearly indicate a loading state.

The design principle is that active workflow state should override idle-state button variety.

### Display Sheet

The display trigger should be labeled `表示`, not presented as an icon-only control.

Opening it reveals a sheet titled `表示する情報` with grouped options:

#### Group 1: 地図の見た目

- `標準`
- `衛星写真`

This group is single-select.

#### Group 2: 地図に重ねる情報

- `通学路`
- `危険・注意`
- `みまもり・観察` or the closest existing feature label used in the codebase

This group is multi-select, depending on which overlay capabilities are already supported.

### Selection Feedback

Selection state should not depend on border color alone.

Each item should include:

- title
- short one-line description
- visible selected state such as `表示中` or a checkmark

This makes the result of tapping obvious, especially for first-time users.

## Component Strategy

### Components To Modify

- [`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-floating-controls.tsx)
- [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx)
- [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx)

### Responsibility Changes

[`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-floating-controls.tsx)

- Becomes the clear owner of mobile action hierarchy
- Shows the `表示` trigger in a more explicit way
- Adapts button availability during reporting states

[`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx)

- Evolves from a small dropdown into a clearer `表示` entry point
- Presents grouped choices with labels and state feedback

[`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx)

- Owns the open/closed state for the display sheet if needed
- Continues owning map style and overlay state
- Wires the revised display UI into existing map behavior

## State Ownership

Keep state ownership in [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx).

Reuse existing state and callbacks for:

- `mapStyle`
- current GPS acquisition state
- report form open state
- location selection state
- existing hazard and heatmap visibility callbacks

If the display UI needs temporary local presentation state, keep it minimal and avoid duplicating source-of-truth map state.

## Responsive Rules

### Mobile

- Bottom action dock remains the main action area
- `表示` opens as a bottom sheet
- Action hierarchy is visually strong enough for one-handed scanning

### Desktop

- The same information grouping can remain, but presentation may stay compact
- A popover or anchored panel is acceptable if it preserves the same mental model

The mental model should stay consistent even if the container differs by viewport.

## Accessibility

- Keep touch targets at least 44px tall
- Preserve accessible names relied on by tests where possible
- Expose pressed or selected state for display options
- Do not rely only on color to communicate active state
- Keep keyboard access intact for action buttons and display options

## Testing Strategy

- Update existing tests for [`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/tests/components/map/map-floating-controls.test.tsx)
- Update GPS-related behavior tests in [`tests/components/map-floating-controls-gps.test.tsx`](C:/Users/s1598/mapsefe/20250615/tests/components/map-floating-controls-gps.test.tsx)
- Add focused tests for the `表示` trigger and grouped display content
- Verify idle, selecting, and loading states so action priority does not regress

## Risks

- `map-container.tsx` is already large, so new presentation logic should stay extracted where possible.
- Existing tests assume specific accessible names, so wording changes need to be intentional.
- Overlay toggles may not map one-to-one to the screenshot labels; naming should follow actual supported features instead of inventing new capabilities.
- Mobile spacing must be checked carefully so the bottom dock, bottom sheet, and map content do not collide.

## Implementation Notes

- Favor small structural changes over broad rewrites.
- Preserve current callbacks and business logic contracts.
- Make the action hierarchy obvious before polishing visual detail.
- Use text labels and state affordances to reduce hesitation, not just stronger colors.
