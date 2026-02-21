# 3D Route PoC Release Readiness Design

**Date:** 2026-02-21  
**Scope:** `3d-route-poc` feature and `/api/mapbox/geocode` access path

## Problem Statement

The current PoC introduces three blocker classes for public release:
1. Missing auth guard on `3d-route-poc` route and geocode API usage path.
2. Race conditions in address search and Street View lookup callbacks.
3. Invalid geocode payload fallback (`0,0`) causing unsafe camera moves.

Secondary issues:
1. Heavy viewer components are remounted on mode toggle.
2. Type safety is weak in map integrations (`any` heavy sections).

## Design Decisions

1. Auth enforcement in depth:
- Add server-side session check on `app/3d-route-poc/page.tsx`.
- Add authenticated-user check at start of `GET` and `POST` in `app/api/mapbox/geocode/route.ts`.
- Return `401` with a stable error payload on unauthorized requests.

2. Input hardening for geocode API:
- Clamp and validate `limit`.
- Reject empty/oversized query.
- Parse coordinate-like params with finite-number checks.

3. Address search race and null handling:
- Add request sequence + `AbortController` in `AddressSearch`.
- Ignore stale responses.
- Parse only valid coordinate features; never fallback to `0,0`.

4. Street View concurrency hardening:
- Add request sequence guard around `getPanorama` callbacks to ignore stale callbacks.
- Use typed `google.maps` references to reduce `any`.

5. Toggle performance:
- Keep 3D and Street components mounted after first activation and hide via layout classes.
- Avoid repeated full initialization on mode toggling.

## Test Strategy

1. Add failing tests first for:
- `3d-route-poc` page auth redirect behavior.
- `api/mapbox/geocode` unauthorized response behavior.
- `AddressSearch` invalid-coordinate filtering and stale-response suppression.

2. Implement minimal code to pass.
3. Run focused suites first, then broader `test:unit`, then `typecheck`.

## Non-Goals

1. Re-architecting geocoding service internals.
2. Large refactor of Cesium/Google integration patterns.
3. Introducing new backend rate-limiting infrastructure in this change.
