# Map Search POI Search Box Design

**Date:** 2026-03-25

## Problem

[`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx) currently calls Mapbox Geocoding v5 and tries to enable POI search by appending `poi` to the `types` parameter. Mapbox's current Geocoding v5 documentation states that POI data has been removed from v5, so the feature does not satisfy the user-facing requirement to search school and facility names.

## Goal

Make the map search box return school and facility results again without changing the surrounding `MapSearch` component contract or the existing map-selection flow.

## Chosen Approach

Switch `MapSearch` from Geocoding v5 to Mapbox Search Box `/forward` text search:

- keep the existing submit-driven UI and result list
- request `country=jp`, `language=ja`, `limit=8`, `auto_complete=true`
- include POI-capable Search Box `types`
- map Search Box GeoJSON responses into the existing local result model
- derive the school icon from `properties.feature_type === "poi"` and `properties.poi_category`

## Why

- It restores POI search on the supported Mapbox search product instead of relying on a removed v5 feature.
- It keeps the component change small because `/forward` already returns coordinates, so no extra retrieve call is needed on click.
- It avoids changing callers such as [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx).

## Scope

- Modify [`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx)
- Modify [`tests/components/map/map-search.test.tsx`](C:/Users/s1598/mapsefe/20250615/tests/components/map/map-search.test.tsx)

## Risks

- Mapbox documents Japan Search API support as a public beta / limited release, so this should be treated as the supported path for Japanese-language queries in Japan, but still as an external dependency with evolving behavior.
- Search Box response fields differ from Geocoding v5, so tests must assert the new endpoint and schema directly.
