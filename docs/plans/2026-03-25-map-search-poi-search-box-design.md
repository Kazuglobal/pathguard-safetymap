# Map Search POI Search Box Design

**Date:** 2026-03-25

## Problem

[`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx) currently calls Mapbox Geocoding v5 and tries to enable POI search by appending `poi` to the `types` parameter. Mapbox's current Geocoding v5 documentation states that POI data has been removed from v5, so the feature does not satisfy the user-facing requirement to search school and facility names.

## Goal

Make the map search box return school and facility results again without changing the surrounding `MapSearch` component contract or the existing map-selection flow.

## Chosen Approach

Use a two-step search strategy in `MapSearch`:

- try Mapbox Search Box `/forward` first for POI-capable search
- if Search Box returns no results or fails, fall back to Geocoding v5 for address and place search
- keep the existing submit-driven UI and result list
- map both response shapes into the same local result model
- derive the school icon from `properties.feature_type === "poi"` and `properties.poi_category`

## Why

- It restores POI search on the supported Mapbox search product instead of relying on a removed v5 feature.
- It keeps the component change small because `/forward` already returns coordinates, so no extra retrieve call is needed on click.
- It avoids changing callers such as [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx).

## Scope

- Modify [`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx)
- Modify [`tests/components/map/map-search.test.tsx`](C:/Users/s1598/mapsefe/20250615/tests/components/map/map-search.test.tsx)

## Risks

- Mapbox documents Japan Search API support as a public beta / limited release, so Search Box should not be the only path for general map search in this project.
- Search Box and Geocoding return different response fields, so tests must assert both the primary request contract and the fallback behavior.
