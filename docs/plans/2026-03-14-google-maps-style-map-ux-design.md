# Google Maps Style Map UX Design

**Date:** 2026-03-14

## Problem

The current map UI exposes search, display controls, accident heatmap, AR, hazard controls, and reporting actions through separate floating surfaces. This makes the mobile map feel fragmented and harder to scan than a familiar map-first experience such as Google Maps.

The user wants the primary map experience to feel closer to Google Maps, specifically:

- The search field should be the top-most control.
- A horizontal chip row should sit directly below the search field.
- The chip row should include `3D`, `AR`, `事故ヒートマップ`, and `ハザード`.
- Tapping each chip should both activate that mode and open a related settings panel.
- The map style control should move to the Google Maps-like lower-right control area.

## Goals

- Make the map feel map-first and immediately understandable on mobile.
- Consolidate top-of-screen discovery into a single Google Maps-like overlay.
- Reuse existing logic for search, 3D, AR, heatmap, and hazard settings instead of rewriting those features.
- Reduce visual clutter from overlapping top and side controls.
- Keep the existing reporting flow and route hazard logic functional.

## Non-goals

- Rebuilding map data fetching, report submission, or AR rendering behavior.
- Changing the underlying map provider or replacing Mapbox.
- Redesigning the full bottom reporting workflow.
- Reworking unrelated dashboard or sidebar features outside the main map page.

## Chosen Approach

Create a new top overlay for [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx) that becomes the primary discovery surface for map search and quick map modes.

The overlay will contain:

- A rounded search bar at the very top using the existing search behavior.
- A horizontally scrollable chip row below it for `3D`, `AR`, `事故ヒートマップ`, and `ハザード`.
- A panel host that opens contextual settings when a chip is selected.

The map style control will move into the lower-right floating control stack, separate from the top overlay, matching the requested Google Maps-like placement.

## Why This Approach

- It produces a strong visual change without forcing a rewrite of the existing feature logic.
- It centralizes discovery around the two places users already expect: top search and lower-right map controls.
- It lets the map container remain the single state owner, which minimizes regression risk across AR, hazard, and heatmap flows.
- It is a better fit than a purely cosmetic rearrangement because the user explicitly wants the chip row and chip-driven settings panels.

## Information Architecture

### Top Overlay

- Position: fixed within the map viewport, aligned to the top safe area.
- Layer 1: search input
- Layer 2: horizontal chip scroller
- Layer 3: contextual settings panel

The overlay should feel like one control zone rather than multiple independent cards.

### Lower-Right Control Stack

- Map style button
- Existing utility controls that still belong to direct map display control

This area should no longer compete with the search surface.

### Existing Bottom Actions

Keep the report and current-location actions, but preserve enough vertical separation so they do not collide with the new top overlay or settings panels.

## Interaction Model

### Search

The search input remains the first visible control and reuses existing geocoding behavior from [`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx).

Desired changes:

- Visual refresh to resemble a mobile map app search bar.
- Better integration with the overlay shell.
- Search results anchored to the new top overlay rather than appearing like a detached card.

### Chips

Each chip behaves as both a toggle and an entry point into settings.

- `3D`: toggles the current 3D state and opens a compact settings card.
- `AR`: enables AR mode and opens a launch/settings card before or while entering AR.
- `事故ヒートマップ`: enables heatmap visibility and opens the accident heatmap settings panel.
- `ハザード`: opens route hazard settings using existing flood/tsunami route hazard controls.

Only one contextual panel should be active at a time.

### Settings Panels

Use a responsive presentation:

- Mobile: bottom sheet style panel
- Desktop: floating card anchored below the overlay or near the active chip

The behavior should be consistent even if the visual container differs by viewport size.

## Component Strategy

### New UI Shell

Add a new presentational component, likely under `components/map/`, to render:

- top overlay container
- search bar shell
- horizontal chip scroller
- contextual panel host

This component should not own core business logic. It should receive state and callbacks from `map-container`.

### Existing Components To Reuse

- [`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx)
- [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx)
- [`components/map/map-3d-toggle.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-3d-toggle.tsx)
- [`components/map/accident-heatmap-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/accident-heatmap-controls.tsx)
- [`components/map/route-hazard-panel.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/route-hazard-panel.tsx)
- [`components/map/ar-view.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/ar-view.tsx)

### Existing Components To Simplify Or Rezone

- [`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-floating-controls.tsx)

That component should stop owning top-of-map discovery actions that move into the new overlay. Its remaining responsibility should be lower-right display controls and the existing bottom CTA surfaces.

## State Ownership

Keep state ownership in [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx).

New UI state to add or normalize:

- active top chip
- active contextual panel
- panel open/closed state

Existing state to reuse:

- `mapStyle`
- `is3DEnabled`
- `isARMode`
- accident heatmap state from `useAccidentHeatmap`
- route hazard state and selected route state

The new overlay should receive these as props and emit callbacks upward.

## Panel Mapping

### 3D

- Reuse existing 3D toggle behavior.
- Show a compact settings card with clear on/off state and room for future expansion.

### AR

- Reuse existing AR activation flow.
- Show an AR entry card rather than exposing a bare icon-only toggle.

### Accident Heatmap

- Reuse the current control body from `AccidentHeatmapControls`.
- Preserve filters, counts, loading states, and errors.
- Only the presentation changes.

### Hazard

- Reuse the existing route hazard logic.
- Prioritize the route selector and flood/tsunami visibility switches.
- Keep detailed evidence or long lists secondary so the first interaction remains lightweight.

## Visual Direction

- Search bar should be the clearest entry point on the page.
- Chips should be pill-shaped, horizontally scrollable, and touch-friendly.
- The top overlay should feel lighter than the current stacked floating cards.
- Panels should share a unified elevation, border, and blur language.
- The style control in the lower-right stack should visually match other map display buttons.

The layout should feel intentionally closer to a consumer map app without copying Google assets or branding.

## Responsive Rules

### Mobile

- Search bar and chips stay pinned near the top safe area.
- Chip row scrolls horizontally.
- Settings panels open from the bottom.
- Right-side display controls stay compact.

### Desktop

- Search bar remains visually primary but does not need full-width treatment.
- Settings panels open as anchored floating cards.
- Lower-right display controls remain clearly separated from reporting controls.

## Accessibility

- Keep touch targets around 44px minimum.
- Ensure each chip exposes selected state and a clear accessible name.
- Preserve keyboard navigation through search, chips, and panel content.
- Prevent panel focus traps from breaking map interaction when closed.

## Testing Strategy

- Add component coverage for the new top overlay and chip interactions.
- Add or update control tests for the lower-right style control placement contract.
- Add responsive coverage for mobile map layout so the search bar remains first and the chips remain horizontally available.
- Reuse existing heatmap and hazard tests where possible instead of rewriting behavioral coverage.

## Risks

- `map-container.tsx` is already large, so the new overlay should avoid adding more inline UI logic there.
- Existing floating controls may overlap until zoning is cleaned up carefully.
- Hazard and heatmap settings are already complex; the new shell must preserve their state contracts instead of wrapping them in ad hoc local state.
- Search result positioning may need adjustment so it does not collide with the contextual settings panel.

## Implementation Notes

- Start by extracting the new overlay into a dedicated component rather than layering more JSX directly into `map-container.tsx`.
- Treat `map-search.tsx` as a behavior component that needs a visual shell refresh, not a full rewrite.
- Move the style selector into the lower-right control stack before removing old top-of-map controls, so there is never a gap in map style access.
- Keep the chip-to-panel mapping explicit in one place to avoid divergent behavior across mobile and desktop.
