# Child vs Young Accident Labels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate `子ども関与` from `若年者関与(24歳以下コード)` in heatmap filtering and popup display.

**Architecture:** Keep `hasChild` strict (`involves_child` only) and add `hasYoung` (`party_a_age=1 OR party_b_age=1`) in RPC payload. Propagate the new property through frontend types and popup rendering while updating UI wording for child filter semantics.

**Tech Stack:** Supabase PostgreSQL (PL/pgSQL), Next.js/TypeScript, Vitest.

---

### Task 1: RPC semantics split

**Files:**
- Create: `supabase/migrations/20260220173000_split_child_and_young_heatmap_rpc.sql`

**Steps:**
1. Add a new migration with `CREATE OR REPLACE FUNCTION public.get_accidents_in_bbox`.
2. Set `properties.hasChild` to `COALESCE(a.involves_child, false)` only.
3. Add `properties.hasYoung` with age-code fallback (`party_a_age=1 OR party_b_age=1`).
4. Change child filter predicate to use only `involves_child`.

### Task 2: Frontend mapping and labels

**Files:**
- Modify: `lib/traffic-accident-heatmap.ts`
- Modify: `components/map/accident-heatmap-layer.tsx`
- Modify: `components/map/accident-heatmap-controls.tsx`

**Steps:**
1. Extend feature properties/types with `hasYoung`.
2. Parse `hasYoung` in popup helper.
3. Render separate badges/messages for child vs young.
4. Update child filter label text to indicate real-child semantics.

### Task 3: Tests

**Files:**
- Modify: `tests/components/map/accident-heatmap-layer-popup.test.tsx`

**Steps:**
1. Add assertion for `hasYoung` normalization.
2. Add popup content assertion that both labels are independently shown.
3. Run targeted Vitest suite.
