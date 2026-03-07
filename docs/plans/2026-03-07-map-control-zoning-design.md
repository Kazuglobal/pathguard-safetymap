# Map Control Zoning Design

**Date:** 2026-03-07

**Problem**

The route hazard layer panel and the map style switcher compete for the same top-left space on the map. This creates visual overlap, ambiguous hierarchy, and poor touch ergonomics on both desktop and mobile.

**Goals**

- Remove overlap between hazard controls and map display controls.
- Preserve the report CTA as the highest-priority mobile action.
- Keep hazard controls prominent because they are closer to the primary task.
- Reduce persistent floating UI on mobile so the map remains readable.

**Non-goals**

- Redesigning the report CTA flow.
- Changing hazard evaluation logic or map data behavior.
- Reworking the sidebar or search bar interaction model.

## Chosen Approach

Use purpose-based zoning.

- Desktop: keep hazard controls in the top-left as the primary analytical control surface.
- Desktop: move display controls such as map style, 3D, AR, and heatmap to the top-right as secondary viewing tools.
- Mobile: keep only a compact trigger in the top-left and open a bottom drawer for hazard and display settings.
- Mobile: keep the report CTA dock persistent as the primary action.

## Rationale

This separates "what to analyze" from "how to view it". The map becomes easier to scan, hazard controls remain discoverable, and mobile interaction no longer stacks multiple floating cards over the map.

## Component Strategy

- Extend `components/map/route-hazard-panel.tsx` so it supports:
  - desktop card mode
  - mobile trigger + drawer mode
- Keep `components/map/map-floating-controls.tsx` focused on:
  - desktop display controls in the top-right
  - mobile report CTA, points, help, and sidebar trigger
- Pass map display state into the route hazard panel so the mobile drawer can own hazard and style/view settings in one place.

## Interaction Details

### Desktop

- `RouteHazardPanel` stays visible as a card below the search bar.
- `MapFloatingControls` renders map style, 3D, AR, and heatmap in the top-right cluster.
- Hazard error messaging stays visually associated with the hazard card.

### Mobile

- Replace the persistent hazard card with a compact trigger button.
- Opening the trigger reveals a bottom drawer containing:
  - route selector
  - flood/tsunami toggles
  - map style selector
  - 3D, AR, and heatmap toggles
- The bottom action dock continues prioritizing report actions.

## Testing Strategy

- Add component tests for `RouteHazardPanel` desktop and mobile modes.
- Update `MapFloatingControls` tests to confirm:
  - desktop still exposes display controls
  - mobile no longer renders the persistent top-left map style control

## Risks

- Drawer and dropdown primitives can be awkward in jsdom tests.
- Hiding mobile persistent controls must not accidentally remove access to 3D, AR, or heatmap.
- Existing map page spacing may require minor top offsets after control relocation.
