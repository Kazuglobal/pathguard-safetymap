# Map Style Selected Badge No-Wrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the blue `表示中` badge in map-style cards on one line by slightly reducing its size and enforcing no-wrap behavior.

**Architecture:** Update only the selected map-style badge in [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx). Lock the behavior with a focused component test so the map-style badge remains compact without affecting overlay badges.

**Tech Stack:** React 19, Next.js, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Add a failing regression test for the blue selected badge

**Files:**
- Modify: `tests/components/map/map-style-selector.test.tsx`
- Test: `components/map/map-style-selector.tsx`

**Step 1: Write the failing test**

Add a test that opens the display sheet, finds the selected map-style badge, and asserts it has the no-wrap and compact-size utility classes.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: FAIL because the current blue badge does not yet include the compact no-wrap classes.

**Step 3: Write minimal implementation**

Update the blue badge classes to:

- `whitespace-nowrap`
- smaller horizontal padding
- slightly smaller text
- slightly smaller check icon

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: PASS with the new badge regression test green.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-15-map-style-selected-badge-nowrap-design.md docs/plans/2026-03-15-map-style-selected-badge-nowrap.md tests/components/map/map-style-selector.test.tsx components/map/map-style-selector.tsx
git commit -m "fix: keep map style selected badge on one line"
```
