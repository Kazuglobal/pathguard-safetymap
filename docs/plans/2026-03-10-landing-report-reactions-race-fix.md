# Landing Report Reactions Race Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the landing reaction race conditions so the UI stays consistent with persisted state.

**Architecture:** Keep the existing client hook, add local concurrency guards, and merge server-loaded reactions into local optimistic state. Update the migration to match the repository's RLS policy conventions.

**Tech Stack:** React hooks, Supabase client, Vitest, Testing Library, SQL migrations

---

### Task 1: Add regression tests for the hook races

**Files:**
- Modify: `tests/unit/hooks/use-landing-report-reactions.test.ts`

**Step 1: Write the failing test**

Add:

```ts
it("初回ロード前のトグルが遅延ロードで上書きされない", async () => {
  // delay the initial select, toggle first, then resolve select
})

it("同じリアクションの連打では重複書き込みしない", async () => {
  // fire two toggles before the first insert settles
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hooks/use-landing-report-reactions.test.ts`
Expected: the new regression tests fail for the current hook behavior.

**Step 3: Write minimal implementation**

Update the hook to:

- guard duplicate in-flight toggles by reaction key
- merge initial fetch results into current state
- keep optimistic local changes made before initial load completes

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hooks/use-landing-report-reactions.test.ts`
Expected: all hook tests pass.

**Step 5: Commit**

```bash
git add tests/unit/hooks/use-landing-report-reactions.test.ts hooks/use-landing-report-reactions.ts
git commit -m "fix: prevent landing reaction race conditions"
```

### Task 2: Align the migration with existing RLS policy style

**Files:**
- Modify: `supabase/migrations/20260309235500_add_landing_report_reactions.sql`

**Step 1: Write the failing test**

There is no migration test today, so use a narrow content assertion by extending an existing migration-test pattern only if needed.

**Step 2: Run test to verify it fails**

If a migration assertion is added, run the specific test file first.

**Step 3: Write minimal implementation**

Change:

```sql
auth.uid() = user_id
```

to:

```sql
user_id = (SELECT auth.uid())
```

for select/insert/delete policies.

**Step 4: Run test to verify it passes**

Run the targeted migration test if one was added; otherwise rely on direct file inspection plus the review pass.

**Step 5: Commit**

```bash
git add supabase/migrations/20260309235500_add_landing_report_reactions.sql
git commit -m "chore: align landing reaction rls policy style"
```

### Task 3: Verify impacted suite and re-review

**Files:**
- Modify: `tests/components/hiyari-hat-report.test.tsx` only if behavior coverage needs expansion

**Step 1: Run targeted tests**

Run:

```bash
npx vitest run tests/unit/hooks/use-landing-report-reactions.test.ts tests/components/hiyari-hat-report.test.tsx
```

Expected: all targeted tests pass.

**Step 2: Re-review the touched files**

Check:

- no remaining High or Medium findings
- no unguarded stale-state writes
- no policy-style regressions

**Step 3: Report result**

Summarize findings, validation evidence, and any residual Low risk.
