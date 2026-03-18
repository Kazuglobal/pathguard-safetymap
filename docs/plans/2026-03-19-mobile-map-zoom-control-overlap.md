# Mobile Map Zoom Control Overlap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop the mobile `/map` screen from rendering overlapping Mapbox `+ / -` zoom controls while keeping desktop zoom controls unchanged.

**Architecture:** Add a tiny helper that decides whether the Mapbox `NavigationControl` should render for the current viewport, cover it with a focused unit test, and use that helper inside the existing map initialization effect in [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx). This keeps the fix local and avoids adding more layout-specific offsets.

**Tech Stack:** Next.js App Router, React 19, Mapbox GL JS, Vitest

---

### Task 1: Add a failing regression test for the viewport rule

**Files:**
- Create: `tests/unit/lib/mapbox-controls.test.ts`
- Test: `lib/mapbox-controls.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { shouldShowMapNavigationControl } from "@/lib/mapbox-controls"

describe("shouldShowMapNavigationControl", () => {
  it("hides Mapbox zoom controls on mobile and keeps them on desktop", () => {
    expect(shouldShowMapNavigationControl(true)).toBe(false)
    expect(shouldShowMapNavigationControl(false)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/mapbox-controls.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Create the helper with the smallest possible logic:

```ts
export function shouldShowMapNavigationControl(isMobile: boolean) {
  return !isMobile
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/mapbox-controls.test.ts`

Expected: PASS.

### Task 2: Wire the helper into map initialization

**Files:**
- Modify: `components/map/map-container.tsx`
- Modify: `lib/mapbox-controls.ts`

**Step 1: Write the failing test**

Use the helper test from Task 1 as the failing regression test for the behavior change.

**Step 2: Run test to verify the failure**

Run: `npx vitest run tests/unit/lib/mapbox-controls.test.ts`

Expected: PASS after Task 1, establishing the expected behavior before wiring it into production code.

**Step 3: Write minimal implementation**

Guard the `NavigationControl` registration:

```ts
if (shouldShowMapNavigationControl(isMobile)) {
  map.current?.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right")
}
```

Keep `GeolocateControl` registration unchanged.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/mapbox-controls.test.ts tests/components/map/map-floating-controls.test.tsx`

Expected: PASS.

### Task 3: Verify the targeted map UI behavior

**Files:**
- No additional code changes expected

**Step 1: Run focused verification**

Run: `npx vitest run tests/unit/lib/mapbox-controls.test.ts tests/components/map/map-floating-controls.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Manual check**

```text
1. Open /map on a phone-sized viewport.
2. Confirm the custom display dock remains visible at bottom-right.
3. Confirm Mapbox + / - buttons are no longer rendered there.
4. Open /map on desktop and confirm + / - buttons still appear.
```
