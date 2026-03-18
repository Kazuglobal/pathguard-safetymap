# Mobile Map Zoom Control Overlap Design

**Date:** 2026-03-19

## Problem

On the mobile `/map` screen, the Mapbox `+ / -` zoom control is rendered in the same bottom-right region as the custom map display dock, so the controls overlap and become hard to use.

## Goal

Prevent the mobile map zoom controls from overlapping with the custom mobile dock while preserving desktop behavior.

## Chosen Approach

Hide the Mapbox `NavigationControl` on mobile and keep it enabled on desktop.

- keep `GeolocateControl` on mobile
- keep the existing custom mobile display dock unchanged
- drive the behavior from the existing `isMobile` viewport state in `map-container`

## Why

- It removes the conflicting control instead of adding more layout offsets.
- Mobile users still have pinch-to-zoom and the existing custom dock.
- Desktop users keep the explicit `+ / -` buttons where they are already expected.

## Scope

- Modify [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx)
- Add a targeted regression test in [`tests/unit/lib/mapbox-controls.test.ts`](C:/Users/s1598/mapsefe/20250615/tests/unit/lib/mapbox-controls.test.ts)
- Add a small helper in [`lib/mapbox-controls.ts`](C:/Users/s1598/mapsefe/20250615/lib/mapbox-controls.ts)
