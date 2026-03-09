# Mobile Heatmap Button Stack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** モバイル地図で左上の `事故` ボタンを `ハザード・地図` の直下に配置し、常に見えるようにする。

**Architecture:** 既存の `getAccidentHeatmapControlContainerClass()` を最小変更し、モバイル時だけ縦位置を下げる。回帰防止はレイアウトヘルパーのクラス文字列を対象にしたテストで固定する。

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Lock the mobile position with a failing test

**Files:**
- Modify: `tests/components/map/accident-heatmap-controls.test.tsx`
- Modify: `components/map/accident-heatmap-control-layout.ts`

**Step 1: Write the failing test**

Add a test that asserts the mobile layout helper returns a class containing a lower stacked top offset instead of the current shared row.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`
Expected: FAIL because the helper still returns the old mobile top offset.

**Step 3: Write minimal implementation**

Change the mobile branch in `getAccidentHeatmapControlContainerClass()` to use the stacked offset.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`
Expected: PASS

### Task 2: Run focused verification

**Files:**
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`
- Test: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Run focused UI tests**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx tests/components/map/map-floating-controls.test.tsx`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS
