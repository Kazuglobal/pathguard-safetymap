# Map Style Selected Badge No-Wrap Design

**Date:** 2026-03-15

## Problem

The blue `表示中` badge inside the map-style cards can wrap in narrow layouts, which makes the selected state harder to scan and visually noisier than intended.

## Goal

Keep the blue selected-state badge on one line without changing the wording.

## Chosen Approach

Adjust only the blue badge used in the map-style cards:

- add `whitespace-nowrap`
- reduce horizontal padding slightly
- reduce the badge font size slightly
- reduce the check icon size slightly

## Why

- It solves the wrapping issue directly.
- It preserves the current wording and state model.
- It avoids unrelated changes to the green overlay badges.

## Scope

- Modify [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx)
- Add a targeted regression test in [`tests/components/map/map-style-selector.test.tsx`](C:/Users/s1598/mapsefe/20250615/tests/components/map/map-style-selector.test.tsx)
