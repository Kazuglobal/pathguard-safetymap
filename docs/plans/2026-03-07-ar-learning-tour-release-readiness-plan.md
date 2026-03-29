# AR Learning Tour Release Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the AR learning-tour state machine so reviewed/saved progress persists through visibility changes and the tour advances to the next unfinished stop reliably.

**Architecture:** Keep the change inside `components/map/ar-view.tsx`. Add regression coverage around state transitions using a focused test harness instead of broad UI rewrites. Preserve the existing learning content generation and presentation components.

**Tech Stack:** React, Next.js client components, Vitest, Testing Library

---

### Task 1: Capture regression behavior

**Files:**
- Modify: `tests/components/map/ar-view-learning-tour.test.tsx`
- Test: `tests/components/map/ar-view-learning-tour.test.tsx`

**Step 1: Write the failing test**

- Add one test proving a reviewed stop stays reviewed after it temporarily leaves the visible set.
- Add one test proving the active stop advances to an earlier pending item when the visible order changes.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/ar-view-learning-tour.test.tsx`
Expected: FAIL on the new assertions.

**Step 3: Write minimal implementation**

- Remove visibility-based pruning of `tourProgress`.
- Update tour status progression to select the next pending stop from the recomputed stop list.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/ar-view-learning-tour.test.tsx`
Expected: PASS.

### Task 2: Re-run related suite

**Files:**
- Verify: `components/map/ar-view.tsx`
- Verify: `tests/components/map/ar-hazard-card-learning.test.tsx`
- Verify: `tests/unit/lib/ar-learning-tour.test.ts`

**Step 1: Run the impacted tests**

Run: `npx vitest run tests/components/map/ar-view-learning-tour.test.tsx tests/components/map/ar-hazard-card-learning.test.tsx tests/unit/lib/ar-learning-tour.test.ts`
Expected: PASS.

**Step 2: Review for remaining findings**

- Re-check the five release lenses against the updated files.

**Step 3: Commit**

Run after approval: `git add components/map/ar-view.tsx tests/components/map/ar-view-learning-tour.test.tsx docs/plans/2026-03-07-ar-learning-tour-release-readiness-design.md docs/plans/2026-03-07-ar-learning-tour-release-readiness-plan.md && git commit -m "fix(ar): stabilize learning tour progress"`
