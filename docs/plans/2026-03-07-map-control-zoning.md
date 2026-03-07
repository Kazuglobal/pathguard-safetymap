# Map Control Zoning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate hazard controls from map display controls so desktop and mobile map UI no longer overlap or compete for the same space.

**Architecture:** Keep hazard state in `MapContainer`, but split presentation by viewport. `RouteHazardPanel` becomes responsive and owns the mobile drawer UI for hazard plus display settings. `MapFloatingControls` becomes a display-controls surface on desktop and a CTA/status surface on mobile.

**Tech Stack:** Next.js, React, Tailwind CSS, Radix UI, Vaul Drawer, Vitest, Testing Library

---

### Task 1: Lock the new UX in component tests

**Files:**
- Create: `tests/components/map/route-hazard-panel.test.tsx`
- Modify: `tests/components/map/map-floating-controls.test.tsx`
- Test: `tests/components/map/route-hazard-panel.test.tsx`
- Test: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Write the failing test**

- Add a test proving desktop `RouteHazardPanel` renders as a visible card.
- Add a test proving mobile `RouteHazardPanel` renders a trigger and reveals hazard/display settings in a drawer.
- Add a test proving mobile `MapFloatingControls` no longer renders the persistent map style selector.
- Add a test proving desktop `MapFloatingControls` still renders the display controls cluster.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: FAIL because the new responsive panel behavior does not exist yet.

**Step 3: Write minimal implementation**

- Add the responsive API surface required by the tests.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: PASS

### Task 2: Implement responsive hazard/display zoning

**Files:**
- Modify: `components/map/route-hazard-panel.tsx`
- Modify: `components/map/map-floating-controls.tsx`
- Modify: `components/map/map-container.tsx`
- Optionally modify: `components/map/map-style-selector.tsx`

**Step 1: Write the failing test**

- Use the Task 1 tests as the executable spec.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: FAIL until the new layout and props are wired through.

**Step 3: Write minimal implementation**

- Add a mobile trigger + drawer mode to `RouteHazardPanel`.
- Move desktop display controls in `MapFloatingControls` to the top-right.
- Hide the old persistent left-top display stack on mobile.
- Pass display-control props from `MapContainer` into `RouteHazardPanel`.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: PASS

### Task 3: Run focused verification

**Files:**
- Verify only

**Step 1: Run component tests**

Run: `pnpm exec vitest run tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx`

Expected: PASS

**Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: PASS
