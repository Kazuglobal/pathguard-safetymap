# Map Overlay Dismiss Behavior Design

**Date:** 2026-03-14

## Problem

The new Google-Maps-style top overlay works visually, but its contextual panels can block too much of the map. The user explicitly wants the obstructive panels to be dismissible without introducing extra close buttons or persistent chrome.

The required dismissal gestures are:

- re-tap the same chip to close its panel
- tap the map canvas to close any open top panel
- tap the map canvas to close the search results list as well

## Goals

- Restore map visibility quickly with natural gestures.
- Keep the chip interaction model simple and predictable.
- Preserve the search input value when the suggestion list closes.
- Avoid adding new visible close buttons or extra control clutter.

## Non-goals

- Redesigning the chip layout or panel contents.
- Changing map search result ranking or geocoding behavior.
- Closing AR mode, 3D mode, or heatmap visibility automatically when a panel closes.
- Reworking unrelated map sidebar or report form interactions.

## Chosen Approach

Keep state ownership split by responsibility:

- `map-container.tsx` owns the active top panel state and closes it on map canvas taps.
- `map-top-overlay.tsx` detects same-chip re-taps and converts them into `onPanelChange(null)`.
- `map-search.tsx` gains an external close signal so the parent can close only the result list while preserving the current query text.

This gives the map canvas a single "clear overlays" gesture while keeping each component responsible for its own local UI.

## Why This Approach

- It matches the user’s requested interaction exactly.
- It avoids adding new buttons that compete with the map.
- It preserves existing search input behavior instead of forcing a full reset.
- It minimizes risk because it extends current state boundaries instead of inventing a new overlay manager.

## Interaction Rules

### Chips

- Pressing a chip with no active matching panel opens that panel.
- Pressing a different chip switches directly to the new panel.
- Pressing the currently active chip closes the panel.

### Map Tap

- Tapping the map canvas closes the active top panel.
- Tapping the map canvas also closes the search results list.
- The search text remains in the input.
- Map tap should not disable the underlying feature state such as 3D enabled, AR mode active, or heatmap visibility.

### Search Result Selection

- Selecting a search result closes the result list.
- Selecting a search result does not automatically close an unrelated active top chip panel.

## State Model

### `map-container.tsx`

Owns:

- `activeTopPanel`
- a monotonically changing search-dismiss token or counter

Responsibilities:

- increment the search-dismiss token on map tap
- set `activeTopPanel` to `null` on map tap
- pass the close token into `MapSearch`

### `map-top-overlay.tsx`

Owns no durable app state.

Responsibilities:

- compare the tapped chip with `activePanel`
- call `onPanelChange(null)` when the same chip is tapped again
- call `onPanelChange(otherPanel)` when switching panels

### `map-search.tsx`

Owns:

- query text
- result list
- local result visibility

Responsibilities:

- watch the external close signal
- close the result list when that signal changes
- keep the query text untouched

## Implementation Notes

- Prefer a numeric `dismissSearchResultsSignal` counter over a boolean flag so repeated map taps always create a detectable change.
- Reuse the existing map click integration in `map-container.tsx` rather than adding a second map-wide click listener just for dismissal.
- Keep result-list dismissal separate from clearing the text field.
- Avoid coupling panel dismissal with feature toggles. Closing UI is not the same as disabling the feature.

## Testing Strategy

- Add a component test for `MapTopOverlay` proving same-chip re-tap closes the active panel.
- Add a component test for `MapSearch` proving an external close signal hides results but keeps the current query.
- Add a map-container-level or integration-oriented test proving a map tap clears `activeTopPanel`.
- If practical, add responsive/browser coverage proving the map regains visibility after tapping outside the overlay.

## Risks

- `map-container.tsx` already has complex click handling, so dismissal wiring must not interfere with report-location selection mode.
- Search result dismissal can regress if it still relies only on click-outside logic.
- If map taps close panels during flows that intentionally need the overlay open, the behavior may feel too aggressive; for now, that tradeoff is acceptable because the user asked specifically to prioritize map visibility.
