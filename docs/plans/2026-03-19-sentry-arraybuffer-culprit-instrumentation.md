# Sentry ArrayBuffer Culprit Instrumentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Record enough Sentry context around large file `arrayBuffer()` calls to identify the exact route and upload metadata when an allocation failure happens again.

**Architecture:** Add a small shared helper that sets Sentry context and breadcrumbs immediately before reading uploaded files into memory and captures extra context when the read throws. Wire that helper into the three candidate Node routes that currently call `file.arrayBuffer()` directly so future Sentry events show the route path, field name, file metadata, and read phase.

**Tech Stack:** Next.js App Router, `@sentry/nextjs`, Vitest

---

### Task 1: Shared Sentry upload helper

**Files:**
- Create: `lib/sentry-upload-context.ts`
- Test: `tests/unit/lib/sentry-upload-context.test.ts`

**Step 1: Write the failing test**

Add tests that expect the helper to:
- call `Sentry.addBreadcrumb` before the `arrayBuffer()` read
- call `Sentry.setContext` with route, field, filename, mime type, and byte size
- call `Sentry.captureException` with the same context when the read throws

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/sentry-upload-context.test.ts`
Expected: FAIL because the helper file does not exist yet.

**Step 3: Write minimal implementation**

Create a helper that accepts `{ route, fieldName, file }`, sets Sentry context/breadcrumbs, awaits `file.arrayBuffer()`, and rethrows after capturing context on failure.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/sentry-upload-context.test.ts`
Expected: PASS

### Task 2: Instrument `generate-image`

**Files:**
- Modify: `app/api/gemini/generate-image/route.ts`
- Modify: `tests/unit/app/api/gemini-generate-image-route.test.ts`

**Step 1: Write the failing test**

Add a test that posts a multipart request with an image and expects Sentry instrumentation to receive route metadata for `/api/gemini/generate-image`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/app/api/gemini-generate-image-route.test.ts`
Expected: FAIL because the route still calls `file.arrayBuffer()` directly.

**Step 3: Write minimal implementation**

Replace the inline `Buffer.from(await file.arrayBuffer())` with the shared helper.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/app/api/gemini-generate-image-route.test.ts`
Expected: PASS

### Task 3: Instrument `generate-prompts`

**Files:**
- Modify: `app/api/gemini/generate-prompts/route.ts`
- Create: `tests/unit/app/api/gemini-generate-prompts-route.test.ts`

**Step 1: Write the failing test**

Add a new route test that posts multipart form data with an image and expects Sentry instrumentation to receive route metadata for `/api/gemini/generate-prompts`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/app/api/gemini-generate-prompts-route.test.ts`
Expected: FAIL because no test file or instrumentation exists yet.

**Step 3: Write minimal implementation**

Replace the inline `Buffer.from(await file.arrayBuffer())` with the shared helper.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/app/api/gemini-generate-prompts-route.test.ts`
Expected: PASS

### Task 4: Instrument `image-process`

**Files:**
- Modify: `app/api/image/process/route.ts`
- Modify: `tests/unit/app/api/image-process-auth-and-type.test.ts`

**Step 1: Write the failing test**

Add a test that uploads a file and expects Sentry instrumentation to receive route metadata for `/api/image/process`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/app/api/image-process-auth-and-type.test.ts`
Expected: FAIL because the route still calls `file.arrayBuffer()` directly.

**Step 3: Write minimal implementation**

Replace the inline `Buffer.from(await file.arrayBuffer())` with the shared helper.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/app/api/image-process-auth-and-type.test.ts`
Expected: PASS

### Task 5: Focused verification

**Files:**
- Modify: `lib/sentry-upload-context.ts`
- Modify: `app/api/gemini/generate-image/route.ts`
- Modify: `app/api/gemini/generate-prompts/route.ts`
- Modify: `app/api/image/process/route.ts`
- Modify: `tests/unit/app/api/gemini-generate-image-route.test.ts`
- Create: `tests/unit/app/api/gemini-generate-prompts-route.test.ts`
- Modify: `tests/unit/app/api/image-process-auth-and-type.test.ts`
- Create: `tests/unit/lib/sentry-upload-context.test.ts`

**Step 1: Run focused tests**

Run:
- `npx vitest run tests/unit/lib/sentry-upload-context.test.ts`
- `npx vitest run tests/unit/app/api/gemini-generate-image-route.test.ts`
- `npx vitest run tests/unit/app/api/gemini-generate-prompts-route.test.ts`
- `npx vitest run tests/unit/app/api/image-process-auth-and-type.test.ts`

**Step 2: Confirm output**

Expected: all touched tests pass with no new failures.
