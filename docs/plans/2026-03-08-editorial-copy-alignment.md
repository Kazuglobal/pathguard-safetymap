# Editorial Copy Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 固定配列ベースの通学路ニュース/SAFE MAGAZINE導線から、実データ更新を期待させる文言と相対時刻表示を取り除く。

**Architecture:** UIコピーは対象3ファイルで編集方針に合わせて差し替える。`lib/school-route-news.ts` の日付フォーマットは常に絶対日付を返すようにして、一覧・詳細の両方で鮮度誤認を抑える。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 日付表示の期待値を固定する

**Files:**
- Create: `docs/plans/2026-03-08-editorial-copy-alignment.md`
- Create: `tests/unit/lib/school-route-news-format.test.ts`
- Modify: `lib/school-route-news.ts`

**Step 1: Write the failing test**

`formatNewsDate()` が最近の日時でも相対表示ではなく `YYYY.MM.DD` を返すことをテストする。

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/lib/school-route-news-format.test.ts`
Expected: FAIL because the current implementation returns relative text such as `たった今`.

**Step 3: Write minimal implementation**

`formatNewsDate()` を絶対日付専用に変更する。

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/lib/school-route-news-format.test.ts`
Expected: PASS

### Task 2: コピーの誤認を防ぐ

**Files:**
- Create: `tests/components/editorial-copy-alignment.test.tsx`
- Modify: `components/landing/SchoolRouteNewsSection.tsx`
- Modify: `app/school-route-news/page.tsx`
- Modify: `app/safe-magazine/page.tsx`

**Step 1: Write the failing test**

対象3ファイルのヘッダー/補助文言が `編集部選定` / `特集記事` 系の表現になっていることをテストする。

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/editorial-copy-alignment.test.tsx`
Expected: FAIL because the current UI still renders `リアルタイム` / `リアルタイムニュース` / `最新情報`.

**Step 3: Write minimal implementation**

対象コピーのみ差し替える。鮮度誤認が強い `速報` バッジも `注目` に落とす。

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/editorial-copy-alignment.test.tsx`
Expected: PASS

### Task 3: 変更をまとめて検証する

**Files:**
- Modify: `components/landing/SchoolRouteNewsSection.tsx`
- Modify: `app/school-route-news/page.tsx`
- Modify: `app/safe-magazine/page.tsx`
- Modify: `lib/school-route-news.ts`
- Create: `tests/unit/lib/school-route-news-format.test.ts`
- Create: `tests/components/editorial-copy-alignment.test.tsx`

**Step 1: Run targeted tests**

Run: `pnpm exec vitest run tests/unit/lib/school-route-news-format.test.ts tests/components/editorial-copy-alignment.test.tsx`
Expected: PASS

**Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS
