# Mobile Heatmap Trigger Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the mobile heatmap trigger visible during normal map usage, including mobile location-selection mode.

**Architecture:** Extract the heatmap-control visibility gate from `MapContainer` into a small pure helper. Update the helper so mobile hides the trigger only while the report form is open, not while location selection is active.

**Tech Stack:** React, Next.js App Router, Tailwind CSS, Vitest

---

### Task 1: Add regression coverage for mobile trigger visibility

**Files:**
- Modify: `components/map/accident-heatmap-control-layout.ts`
- Modify: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

```tsx
it('keeps the mobile trigger visible during location selection', () => {
  expect(
    shouldRenderAccidentHeatmapControl({
      isMobile: true,
      awaitingLocationSelection: true,
      isReportFormOpen: false,
    }),
  ).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL because the helper does not exist yet or still hides the control during location selection.

**Step 3: Write minimal implementation**

Add the test only. Do not change production code yet.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL with missing helper or wrong boolean result.

### Task 2: Implement the visibility helper and wire it into the map container

**Files:**
- Modify: `components/map/accident-heatmap-control-layout.ts`
- Modify: `components/map/map-container.tsx`
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Use the failing test from Task 1**

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL before production changes.

**Step 3: Write minimal implementation**

```ts
export function shouldRenderAccidentHeatmapControl({
  isMobile,
  awaitingLocationSelection,
  isReportFormOpen,
}: {
  isMobile: boolean
  awaitingLocationSelection: boolean
  isReportFormOpen: boolean
}) {
  if (!isMobile) return !awaitingLocationSelection
  return !isReportFormOpen
}
```

Use that helper in `MapContainer` instead of the inline condition.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: PASS.

### Task 3: Verify impacted UI still passes

**Files:**
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`
- Test: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Run targeted verification**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.
