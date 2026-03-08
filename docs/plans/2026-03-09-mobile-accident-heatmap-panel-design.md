# Mobile Accident Heatmap Panel Design

**Date:** 2026-03-09

## Problem

On mobile, the accident heatmap control card stays visible on top of the map and blocks too much of the viewing area. This reduces map readability and makes the analysis surface feel cramped.

## Goals

- Maximize visible map area on mobile.
- Keep accident heatmap controls quickly accessible.
- Preserve clear state visibility for heatmap on/off and active filters.
- Align the heatmap control pattern with the existing mobile map control zoning approach.

## Non-goals

- Redesigning desktop heatmap controls.
- Changing heatmap data, filters, or loading behavior.
- Reworking unrelated map actions such as report submission or route hazard flows.

## Chosen Approach

Use a compact top-left trigger on mobile and move the full accident heatmap controls into a bottom sheet.

Desktop keeps the current floating card behavior. Mobile replaces the persistent card with a lightweight trigger that opens a bottom sheet for configuration.

## Why This Approach

- The map is the primary content surface on mobile, so persistent control cards are too expensive.
- A trigger plus bottom sheet preserves discoverability without permanently occupying the viewport.
- This pattern matches the existing mobile map interaction direction already documented for other control surfaces.

## Mobile Interaction Model

### Trigger

- Position: top-left
- Shape: compact pill button
- Contents: flame icon and `事故` label
- Size: touch-friendly, around 44px tall
- Default state: neutral white surface with soft shadow
- Active heatmap state: lightly tinted warm background with stronger icon emphasis
- Active filter state: small badge showing that filters are applied

The trigger remains fixed in place regardless of sheet state so the control is easy to find repeatedly.

### Bottom Sheet

- Opens from the bottom of the screen
- Initial height: about 64svh
- Supports close via swipe down, backdrop tap, or close button
- Keeps map context partially visible behind it
- Does not reset heatmap visibility or filter state when dismissed

## Content Hierarchy

Inside the mobile bottom sheet, order controls by immediate user value:

1. Header with title, close action, and heatmap visibility toggle
2. Current status row with feature count and loading state
3. Time range controls
4. Severity filter
5. Child involvement toggle
6. Young involvement toggle
7. Pedestrian involvement toggle
8. Short explanatory hints and zoom behavior note

This keeps the most important map-state controls at the top and pushes lower-priority explanatory copy to the end.

## Behavior Rules

- The trigger is always visible on mobile.
- The bottom sheet can be opened even when the heatmap is currently hidden.
- Filter changes apply immediately.
- Dismissing the sheet preserves all current state.
- Error messaging appears near the top of the sheet, close to status.
- The trigger should not display heavy data such as counts or verbose labels.

## Visual Direction

- Favor low visual weight while closed.
- Use compact typography and short labels.
- Avoid persistent multi-section cards over the map on mobile.
- Keep animation subtle and predictable.
- Opening animation: around 220-260ms
- Closing animation: around 180-220ms

## Accessibility

- Maintain a minimum touch target around 44px.
- Ensure trigger and sheet controls have clear labels.
- Preserve keyboard and screen reader semantics for the toggle and sheet close action.
- Keep contrast sufficient in both active and inactive trigger states.

## Implementation Notes

- Update `components/map/accident-heatmap-controls.tsx` to support distinct desktop and mobile render paths.
- Keep desktop behavior intact.
- Add mobile sheet state near the map container control orchestration where needed.
- Ensure the mobile trigger sits cleanly within the existing top-left map control zone.
- Reuse existing UI primitives where possible instead of introducing a new control system.

## Testing Strategy

- Add component coverage for mobile trigger rendering and sheet open/close behavior.
- Verify mobile no longer renders the persistent heatmap card by default.
- Verify heatmap state and filter state persist after closing and reopening the sheet.
- Verify the active filter badge appears only when filters differ from default values.

## Risks

- Top-left placement must not collide with other mobile map controls.
- Sheet state and heatmap state can drift if ownership is split across components.
- Responsive tests may need updates if they currently expect the old card layout.
