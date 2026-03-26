# Standard Satellite Preview Image Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `standard-satellite` preview thumbnail with the approved screenshot-based satellite image while keeping the existing UI behavior unchanged.

**Architecture:** Keep the map-style metadata in `components/map/map-style-selector.tsx` as the single source of truth for preview assets. Add one focused regression test that checks the exact preview asset path for the `standard-satellite` option, then update only that metadata entry to point at the approved PNG.

**Tech Stack:** Next.js App Router, React 19, Next Image, Vitest, Testing Library

---

### Task 1: Lock the preview asset path with a failing test

**Files:**
- Modify: `tests/components/map/map-style-selector.test.tsx`
- Test: `components/map/map-style-selector.tsx`

**Step 1: Write the failing test**

Add an assertion that the `衛星写真（最新）` preview image uses `/images/map-style-previews/スクリーンショット 2026-03-26 235329.png`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-style-selector.test.tsx`
Expected: FAIL because the component still points at `standard-satellite.svg`.

**Step 3: Write minimal implementation**

Update the `standard-satellite` map-style entry in `components/map/map-style-selector.tsx` to use the approved PNG asset.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-style-selector.test.tsx`
Expected: PASS with the new asset-path assertion green.

### Task 2: Verify no regression in the selector test file

**Files:**
- Test: `tests/components/map/map-style-selector.test.tsx`

**Step 1: Re-run the focused test file**

Run: `npx vitest run tests/components/map/map-style-selector.test.tsx`
Expected: PASS with all selector assertions green.
