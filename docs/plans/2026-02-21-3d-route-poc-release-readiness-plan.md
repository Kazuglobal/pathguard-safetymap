# 3D Route PoC Release Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove release blockers from the `3d-route-poc` flow across security, edge-case safety, and runtime stability.

**Architecture:** Apply defense in depth at page and API boundaries, then eliminate client race conditions via request sequencing and aborts. Keep rendering behavior stable while reducing expensive viewer reinitialization by preserving mounts across mode switches.

**Tech Stack:** Next.js App Router, Supabase auth helpers, React 19, Vitest + Testing Library, TypeScript.

---

### Task 1: Auth guard tests (RED first)

**Files:**
- Create: `tests/unit/app/3d-route-poc-page-auth.test.tsx`
- Create: `tests/unit/app/api/mapbox-geocode-auth.test.ts`

**Steps:**
1. Write a failing test that unauthenticated access to `3d-route-poc` redirects to `/login`.
2. Write a failing test that authenticated access renders the client component.
3. Write a failing test that unauthenticated `GET /api/mapbox/geocode` returns `401`.
4. Write a failing test that unauthenticated `POST /api/mapbox/geocode` returns `401`.
5. Run only the two new test files and confirm failure reasons are expected.

### Task 2: Implement auth and API input hardening (GREEN)

**Files:**
- Modify: `app/3d-route-poc/page.tsx`
- Modify: `app/api/mapbox/geocode/route.ts`

**Steps:**
1. Add server session check on `3d-route-poc` page using `createServerClient` and `redirect('/login')`.
2. Add `requireAuthenticatedUser` guard for geocode `GET` and `POST`.
3. Add query/limit/coodinate parameter validators and sane limits.
4. Re-run Task 1 tests and confirm pass.

### Task 3: Address search race/null tests (RED first)

**Files:**
- Create: `tests/components/3d-route/address-search.test.tsx`

**Steps:**
1. Write a failing test proving invalid geocode entries (`center` missing) are not rendered/selectable.
2. Write a failing test proving stale response from older request does not replace newer results.
3. Run the new test file and confirm both tests fail for expected reasons.

### Task 4: Implement AddressSearch and StreetView fixes (GREEN)

**Files:**
- Modify: `components/3d-route/address-search.tsx`
- Modify: `components/3d-route/street-view-panel.tsx`
- Modify: `app/3d-route-poc/3d-route-poc-client.tsx`
- Modify: `components/3d-route/cesium-viewer.tsx`

**Steps:**
1. Add `AbortController` + request sequence guard in `AddressSearch`.
2. Validate and filter parsed geocode results before state update.
3. Add stale-callback guard in `StreetViewPanel` location updates.
4. Keep map panels mounted after first activation to avoid expensive reinitialization.
5. Reduce unsafe `any` usage where practical without broad refactors.
6. Re-run address-search tests and confirm pass.

### Task 5: Release-readiness verification and re-review loop

**Files:**
- Review-only: changed files above

**Steps:**
1. Run targeted tests: new test files.
2. Run broader checks: `npm run test:unit` and `npm run typecheck`.
3. Re-run five-lens review and ensure no unresolved High/Medium findings remain.
4. Report residual Low risks explicitly if any.
