# Child Image Prompts Without Kodomo 110 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `子ども110番の家` references from all child-oriented image generation prompts and lock the behavior with regression tests.

**Architecture:** Keep the change local to prompt definition modules. Expose prompt builders only where necessary for focused unit testing, then remove the targeted wording and replace it with image-verifiable guidance.

**Tech Stack:** TypeScript, Vitest, Next.js

---

### Task 1: Lock hazard-game child prompt behavior

**Files:**
- Modify: `C:\Users\s1598\mapsefe\20250615\lib\gemini-hazard.ts`
- Modify: `C:\Users\s1598\mapsefe\20250615\tests\unit\lib\hazard-game-pipeline.test.ts`

**Step 1: Write the failing test**
- Add a test that inspects the child prompt and asserts it does not contain `子ども110番` or `110番の家`.

**Step 2: Run test to verify it fails**
- Run: `pnpm vitest run tests/unit/lib/hazard-game-pipeline.test.ts`

**Step 3: Write minimal implementation**
- Export the prompt builder needed for testing if necessary.
- Remove any child-only wording that can instruct the model to mention `子ども110番の家`.

**Step 4: Run test to verify it passes**
- Run: `pnpm vitest run tests/unit/lib/hazard-game-pipeline.test.ts`

### Task 2: Lock child disaster preset prompts

**Files:**
- Modify: `C:\Users\s1598\mapsefe\20250615\lib\disaster-scenario-prompts.ts`
- Create: `C:\Users\s1598\mapsefe\20250615\tests\unit\lib\disaster-scenario-prompts.test.ts`

**Step 1: Write the failing test**
- Add a test that iterates child audience prompts and asserts they do not contain `子ども110番` or `110番の家`.

**Step 2: Run test to verify it fails**
- Run: `pnpm vitest run tests/unit/lib/disaster-scenario-prompts.test.ts`

**Step 3: Write minimal implementation**
- Replace the forbidden wording with image-verifiable safety spot wording such as shops or places with people visible.

**Step 4: Run test to verify it passes**
- Run: `pnpm vitest run tests/unit/lib/disaster-scenario-prompts.test.ts`

### Task 3: Verify whole change set

**Files:**
- No new files

**Step 1: Run focused verification**
- Run: `pnpm vitest run tests/unit/lib/hazard-game-pipeline.test.ts tests/unit/lib/disaster-scenario-prompts.test.ts`

**Step 2: Run typecheck**
- Run: `pnpm typecheck`

**Step 3: Commit**
- Commit the prompt and test changes with a focused message.
