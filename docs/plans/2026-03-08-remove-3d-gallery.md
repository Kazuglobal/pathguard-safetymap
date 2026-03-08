# Remove 3D Gallery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/report` から 3D ギャラリーを削除し、不要な実装ファイルも除去する

**Architecture:** `app/report/page.tsx` のタブ構成を 2 つに戻し、3D ギャラリーの import と描画を削除する。あわせて `components/report/shared-gallery-3d.tsx` と `public/gallery.html` を削除して死んだ実装を残さない。

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library

---

### Task 1: Add regression test for report tabs

**Files:**
- Create: `tests/components/report-page.test.tsx`
- Modify: none
- Test: `tests/components/report-page.test.tsx`

**Step 1: Write the failing test**

- Render `app/report/page.tsx` with mocked dependencies.
- Assert that `3Dギャラリー` tab is not present.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/report-page.test.tsx`

Expected: FAIL because `3Dギャラリー` is still rendered.

### Task 2: Remove report page 3D gallery UI

**Files:**
- Modify: `app/report/page.tsx`

**Step 1: Remove the 3D gallery import**

**Step 2: Remove the 3D tab trigger and tab content**

**Step 3: Keep the remaining tabs layout valid**

### Task 3: Delete unused 3D gallery implementation

**Files:**
- Delete: `components/report/shared-gallery-3d.tsx`
- Delete: `public/gallery.html`

**Step 1: Remove the component file**

**Step 2: Remove the static gallery asset**

### Task 4: Verify removal

**Files:**
- Test: `tests/components/report-page.test.tsx`

**Step 1: Run the focused component test**

Run: `pnpm vitest run tests/components/report-page.test.tsx`

Expected: PASS

**Step 2: Run production build**

Run: `pnpm build`

Expected: PASS
