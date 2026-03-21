# Push Notification Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the push notification security, duplicate-delivery, and preference-hydration release blockers without changing unrelated behavior.

**Architecture:** Keep the current Web Push design, but harden danger-report delivery with a report-level claim watermark and tighten the notify endpoint to the author-only flow. Restore endpoint-specific preferences from the server during hook initialization and roll back failed optimistic preference updates.

**Tech Stack:** Next.js route handlers, Supabase, Vitest, React hooks

---

### Task 1: Add failing server-side regression tests

**Files:**
- Create: `tests/unit/app/api/push/notify-danger-report.test.ts`
- Create: `tests/unit/app/api/cron/push-danger-reports.test.ts`
- Modify: `tests/unit/app/api/push/subscribe.test.ts`
- Modify: `tests/unit/lib/push-notifications/notify-danger-report.test.ts`

**Step 1: Write the failing tests**

- Cover author-only access to `/api/push/notify-danger-report`
- Cover duplicate suppression when a report has already been claimed/notified
- Cover `GET /api/push/subscribe?endpoint=...`

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/app/api/push/notify-danger-report.test.ts tests/unit/app/api/cron/push-danger-reports.test.ts tests/unit/app/api/push/subscribe.test.ts tests/unit/lib/push-notifications/notify-danger-report.test.ts`

Expected: failures for missing endpoint behavior and missing dedupe logic

### Task 2: Implement report claim and dedupe flow

**Files:**
- Create: `supabase/migrations/20260321213000_harden_push_notifications.sql`
- Modify: `lib/database.types.ts`
- Modify: `lib/push-notifications/notify-danger-report.ts`
- Modify: `app/api/push/notify-danger-report/route.ts`
- Modify: `app/api/cron/push-danger-reports/route.ts`

**Step 1: Add schema support**

- Add nullable `danger_reports.push_notified_at`

**Step 2: Add minimal claim helpers**

- Claim a report with `push_notified_at IS NULL`
- Release the claim on send failure

**Step 3: Tighten route authorization**

- Only claim reports owned by the authenticated user

**Step 4: Restrict cron to unnotified reports**

- Only process recent rows where `push_notified_at IS NULL`

**Step 5: Run targeted tests**

Run: `npx vitest run tests/unit/app/api/push/notify-danger-report.test.ts tests/unit/app/api/cron/push-danger-reports.test.ts tests/unit/lib/push-notifications/notify-danger-report.test.ts`

Expected: pass

### Task 3: Implement preference hydration and rollback

**Files:**
- Modify: `app/api/push/subscribe/route.ts`
- Modify: `hooks/use-push-subscription.ts`
- Modify: `tests/unit/hooks/use-push-subscription.test.ts`
- Modify: `tests/unit/app/api/push/subscribe.test.ts`

**Step 1: Add failing hook tests**

- Existing subscription hydrates saved preferences
- Failed PATCH rolls back optimistic state

**Step 2: Implement GET endpoint**

- Return endpoint-specific preferences for the authenticated user

**Step 3: Implement hook hydration/rollback**

- Fetch saved preferences after discovering existing subscription
- Revert local state if PATCH fails

**Step 4: Run targeted tests**

Run: `npx vitest run tests/unit/app/api/push/subscribe.test.ts tests/unit/hooks/use-push-subscription.test.ts`

Expected: pass

### Task 4: Re-review and verify release gate

**Files:**
- Modify: none unless new findings emerge

**Step 1: Run focused suite**

Run: `npx vitest run tests/unit/app/api/push/notify-danger-report.test.ts tests/unit/app/api/cron/push-danger-reports.test.ts tests/unit/app/api/push/notify-content.test.ts tests/unit/app/api/push/subscribe.test.ts tests/unit/hooks/use-push-subscription.test.ts tests/unit/lib/push-notifications/notify-danger-report.test.ts tests/unit/lib/web-push.test.ts`

Expected: pass

**Step 2: Re-run strict review**

- Security
- Performance
- Maintainability
- Edge cases
- YAGNI

**Step 3: Iterate only if a new High or Medium issue remains**
