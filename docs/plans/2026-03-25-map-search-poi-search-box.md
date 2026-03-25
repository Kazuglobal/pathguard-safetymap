# Map Search POI Search Box Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore school and facility search in the map search box without regressing existing address and place search.

**Architecture:** Keep [`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx) as the single client-side integration point, use Mapbox Search Box `/forward` as the primary POI-aware lookup, and fall back to Geocoding v5 when Search Box returns no usable results. Preserve the external `MapSearch` props and selection behavior while updating the component tests to lock both the Search Box contract and the fallback path.

**Tech Stack:** Next.js App Router, React 19, Mapbox GL JS, Vitest, Testing Library

---

### Task 1: Lock the new API contract in tests

**Files:**
- Modify: `tests/components/map/map-search.test.tsx`
- Test: `components/map/map-search.tsx`

**Step 1: Write the failing test**

Add a test that submits a school query and expects:

- fetch to call `https://api.mapbox.com/search/searchbox/v1/forward`
- query params to include `country=jp`, `language=ja`, `auto_complete=true`, and `types` including `poi`
- Search Box response fields (`geometry.coordinates`, `properties.feature_type`, `properties.poi_category`) to render a school result

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Expected: FAIL because the component still calls Geocoding v5 and reads the old response shape.

**Step 3: Write minimal implementation**

Only add the failing test first. Do not change production code yet.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Expected: FAIL with an assertion showing the wrong endpoint and/or wrong result mapping.

**Step 5: Commit**

```bash
git add tests/components/map/map-search.test.tsx
git commit -m "test: cover map search POI api contract"
```

### Task 2: Switch `MapSearch` to Search Box `/forward` with Geocoding fallback

**Files:**
- Modify: `components/map/map-search.tsx`
- Modify: `tests/components/map/map-search.test.tsx`

**Step 1: Write the minimal production change**

- replace the primary request URL with `/search/searchbox/v1/forward`
- send Search Box parameters:

```ts
const params = new URLSearchParams({
  access_token: accessToken,
  country: "JP",
  language: "ja",
  auto_complete: "true",
  limit: "8",
  types: "address,street,neighborhood,locality,place,district,postcode,region,poi,category",
})
```

- map features from `geometry.coordinates` and `properties`
- render a display label from `properties.full_address ?? properties.name`
- detect school POIs from `properties.feature_type` and `properties.poi_category`
- if Search Box returns an empty feature list, call the existing Geocoding v5 address/place search and map that response into the same result model

**Step 2: Run focused tests**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Expected: PASS.

**Step 3: Refine only if needed**

Keep the existing component API and result-click behavior unchanged.

**Step 4: Re-run the focused tests**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Expected: PASS with no new failures.

**Step 5: Commit**

```bash
git add components/map/map-search.tsx tests/components/map/map-search.test.tsx
git commit -m "fix: use search box api for map poi search"
```

### Task 3: Validate and re-review

**Files:**
- Modify only if validation exposes an issue

**Step 1: Run verification**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Run: `npm run typecheck`

**Step 2: Review the result with five lenses**

- Security
- Performance
- Maintainability
- Edge cases
- YAGNI

**Step 3: Fix any remaining validated issues**

Only if new High or Medium findings appear.

**Step 4: Re-run verification**

Run the same commands again after any fix.

**Step 5: Close out**

Report findings, validation evidence, and any residual external API risk.
