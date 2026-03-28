# Parent Route Simulation Growth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ニュース型ホームを維持したまま、`わが子の通学ダッシュボード` と `投稿後の家族共有体験` を追加し、保護者の投稿率・共有率・継続率を上げる。

**Architecture:** 既存の `landing`、`danger-report`、`notifications`、`route safety` の仕組みを再利用する。Phase 1 は `ホーム最上段ユニット` と `投稿完了 / 共有カード` に集中し、Phase 2 で条件別注意と週次レポートを追加する。ホーム全体は置き換えず、追加コンポーネントと軽量データ取得で差し込む。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase, Mapbox GL, html2canvas, Vitest, Playwright

---

## Backlog Summary

### P0

- [ ] T01 ホーム最上段に `わが子の通学ダッシュボード` を追加する
- [ ] T02 ダッシュボード用のルート安全サマリーデータを組み立てる
- [ ] T03 報告ボトムシートと投稿導線を `家族の安全確認` 文脈へ寄せる
- [ ] T04 投稿フローで `子ども目線シミュレーション + 要約 + 回避行動` を確認できるようにする
- [ ] T05 投稿完了画面を `共有カード中心` に再設計する
- [ ] T06 LINE向け家族共有カードを生成・共有できるようにする

### P1

- [ ] T07 `条件別注意` をダッシュボードへ追加する
- [ ] T08 週次の通学路サマリー通知を追加する
- [ ] T09 KPI イベントを最低限計測できるようにする

## Task Details

### T01: ホーム最上段に `わが子の通学ダッシュボード` を追加する

**Files:**
- Modify: `app/landing/page.tsx`
- Modify: `components/landing/index.ts`
- Create: `components/landing/child-route-dashboard.tsx`
- Test: `tests/components/child-route-dashboard.test.tsx`
- Test: `tests/responsive/landing-page.spec.ts`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import { ChildRouteDashboard } from "@/components/landing/child-route-dashboard"

it("renders quick-check cards above the news feed", () => {
  render(
    <ChildRouteDashboard
      state="ready"
      childName="さくら"
      quickChecks={[
        { id: "today", title: "今日の注意地点", value: "2件", href: "/map" },
      ]}
    />
  )

  expect(screen.getByText("今日の通学3分チェック")).toBeInTheDocument()
  expect(screen.getByText("今日の注意地点")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/child-route-dashboard.test.tsx`
Expected: FAIL with `Cannot find module '@/components/landing/child-route-dashboard'`

**Step 3: Write minimal implementation**

- `components/landing/child-route-dashboard.tsx` を作成する
- `app/landing/page.tsx` の最上段に差し込む
- 既存ニュースセクションの順序は変えず、ヒーローの前に 1 セクション追加する

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/child-route-dashboard.test.tsx`
Expected: PASS

**Step 5: Verify responsive placement**

Run: `npx playwright test tests/responsive/landing-page.spec.ts --project='Mobile Chrome - iPhone 12'`
Expected: dashboard section is visible before the hero/news content

**Step 6: Commit**

```bash
git add app/landing/page.tsx components/landing/index.ts components/landing/child-route-dashboard.tsx tests/components/child-route-dashboard.test.tsx tests/responsive/landing-page.spec.ts
git commit -m "feat: add child route dashboard to landing page"
```

### T02: ダッシュボード用のルート安全サマリーデータを組み立てる

**Files:**
- Create: `hooks/use-child-route-dashboard.ts`
- Modify: `components/landing/child-route-dashboard.tsx`
- Modify: `hooks/use-user-routes.ts`
- Modify: `hooks/use-route-dangers.ts`
- Test: `tests/components/child-route-dashboard.test.tsx`
- Test: `tests/components/route-manager-child-filter.test.tsx`

**Step 1: Write the failing test**

```tsx
it("shows route-linked quick checks for the selected child", async () => {
  render(<ChildRouteDashboard state="ready" childName="さくら" quickChecks={[
    { id: "route", title: "今日の注意地点", value: "3件", href: "/map?route=route-1" },
    { id: "share", title: "直近の共有カード", value: "昨夜 21:00", href: "/report" },
  ]} />)

  expect(screen.getByText("3件")).toBeInTheDocument()
  expect(screen.getByText("直近の共有カード")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/child-route-dashboard.test.tsx`
Expected: FAIL because quick-check states are not rendered correctly

**Step 3: Write minimal implementation**

- `use-child-route-dashboard.ts` で `routes`, `selectedChildId`, `route dangers`, `recent report` をまとめる
- 通学路未登録時、危険0件時、読み込み中の 3 状態を作る
- 最小限のデータで `今日の注意地点`, `条件別注意`, `直近共有カード` を返す

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/child-route-dashboard.test.tsx tests/components/route-manager-child-filter.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-child-route-dashboard.ts components/landing/child-route-dashboard.tsx hooks/use-user-routes.ts hooks/use-route-dangers.ts tests/components/child-route-dashboard.test.tsx tests/components/route-manager-child-filter.test.tsx
git commit -m "feat: wire child route dashboard data"
```

### T03: 報告ボトムシートと投稿導線を `家族の安全確認` 文脈へ寄せる

**Files:**
- Modify: `components/report/report-bottom-sheet.tsx`
- Modify: `components/ui/navigation.tsx`
- Modify: `app/map/page.tsx`
- Test: `tests/responsive/main-app-pages.spec.ts`

**Step 1: Write the failing test**

```tsx
it("shows family-safety framing in the report sheet", () => {
  render(<ReportBottomSheet open onOpenChange={() => {}} />)
  expect(screen.getByText("家族で注意したい危険を報告")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/report-bottom-sheet.test.tsx`
Expected: FAIL because the new copy is missing

**Step 3: Write minimal implementation**

- シート見出しと補助コピーを `共有しましょう` から `家族で使える注意カードを作る` に更新する
- `地図から報告` と `写真付きで報告` の差を明確にし、写真導線を推す
- `router.push("/map?report=open&source=family-safety")` のような導線識別を追加する

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/report-bottom-sheet.test.tsx`
Expected: PASS

**Step 5: Run responsive smoke test**

Run: `npx playwright test tests/responsive/main-app-pages.spec.ts --project='Mobile Chrome - iPhone 12'`
Expected: report bottom sheet copy is readable and buttons are tappable

**Step 6: Commit**

```bash
git add components/report/report-bottom-sheet.tsx components/ui/navigation.tsx app/map/page.tsx tests/components/report-bottom-sheet.test.tsx tests/responsive/main-app-pages.spec.ts
git commit -m "feat: reframe report entry around family safety"
```

### T04: 投稿フローで `子ども目線シミュレーション + 要約 + 回避行動` を確認できるようにする

**Files:**
- Modify: `components/danger-report/danger-report-form.tsx`
- Modify: `components/danger-report/vlm-analysis-panel.tsx`
- Create: `components/danger-report/simulation-quick-summary.tsx`
- Modify: `lib/vlm-analysis.ts`
- Test: `tests/components/report-page.test.tsx`
- Test: `tests/responsive/camera-report-form.spec.ts`

**Step 1: Write the failing test**

```tsx
it("renders a quick summary block after simulation is generated", async () => {
  render(<SimulationQuickSummary summary="車が急に見える" action="白線の内側を歩く" />)

  expect(screen.getByText("車が急に見える")).toBeInTheDocument()
  expect(screen.getByText("白線の内側を歩く")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/report-page.test.tsx`
Expected: FAIL because the summary block does not exist

**Step 3: Write minimal implementation**

- 既存の生成結果から `危険要約` と `回避行動` を抽出する
- `danger-report-form.tsx` にプレビュー領域を追加する
- 投稿前に `子ども目線シミュレーション`, `危険要約`, `回避行動` を並べる

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/report-page.test.tsx`
Expected: PASS

**Step 5: Verify mobile form flow**

Run: `npx playwright test tests/responsive/camera-report-form.spec.ts --project='Mobile Chrome - iPhone 12'`
Expected: generated summary/action are visible without horizontal scroll

**Step 6: Commit**

```bash
git add components/danger-report/danger-report-form.tsx components/danger-report/vlm-analysis-panel.tsx components/danger-report/simulation-quick-summary.tsx lib/vlm-analysis.ts tests/components/report-page.test.tsx tests/responsive/camera-report-form.spec.ts
git commit -m "feat: add parent-friendly simulation summary before submit"
```

### T05: 投稿完了画面を `共有カード中心` に再設計する

**Files:**
- Modify: `components/danger-report/submitted-report-preview.tsx`
- Create: `components/danger-report/post-submit-actions.tsx`
- Modify: `components/map/map-container.tsx`
- Modify: `lib/safety-scoring/route-safety-scorer.ts`
- Test: `tests/components/report-page.test.tsx`
- Test: `tests/components/route-card.test.tsx`

**Step 1: Write the failing test**

```tsx
it("shows share CTA and route score delta after submit", () => {
  render(
    <PostSubmitActions
      routeScoreBefore={72}
      routeScoreAfter={68}
      actionText="交差点の5m手前で止まる"
      onShare={() => {}}
    />
  )

  expect(screen.getByText("72 -> 68")).toBeInTheDocument()
  expect(screen.getByText("家族に共有")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/report-page.test.tsx`
Expected: FAIL because post-submit actions component does not exist

**Step 3: Write minimal implementation**

- `submitted-report-preview.tsx` を単なる画像確認ダイアログから `完了モーダル` に拡張する
- `routeScoreBefore / routeScoreAfter / nextAction` を受け取れるようにする
- 投稿後 CTA を `閉じる` だけで終わらせず `家族に共有` と `通学路で確認` に置き換える

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/report-page.test.tsx tests/components/route-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/danger-report/submitted-report-preview.tsx components/danger-report/post-submit-actions.tsx components/map/map-container.tsx lib/safety-scoring/route-safety-scorer.ts tests/components/report-page.test.tsx tests/components/route-card.test.tsx
git commit -m "feat: add post-submit next actions and route score delta"
```

### T06: LINE向け家族共有カードを生成・共有できるようにする

**Files:**
- Create: `components/report/family-share-card.tsx`
- Create: `lib/report-generation/family-share-card.ts`
- Modify: `components/danger-report/submitted-report-preview.tsx`
- Modify: `app/report/page.tsx`
- Test: `tests/components/family-share-card.test.tsx`
- Test: `tests/components/route-manager-share.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders a compact family share card with summary and map thumbnail", () => {
  render(
    <FamilyShareCard
      title="見通しの悪い交差点"
      summary="小学生の目線では車が急に見える"
      action="白線の内側を歩く"
      mapLabel="東京・千代田区"
      imageUrl="/hazard.png"
    />
  )

  expect(screen.getByText("小学生の目線では車が急に見える")).toBeInTheDocument()
  expect(screen.getByText("白線の内側を歩く")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/family-share-card.test.tsx`
Expected: FAIL because the card component does not exist

**Step 3: Write minimal implementation**

- `FamilyShareCard` コンポーネントを作成する
- `html2canvas` を使って画像化できるヘルパーを `lib/report-generation/family-share-card.ts` に追加する
- `navigator.share` が使える場合は画像共有、使えない場合は画像ダウンロード + テキストコピーへフォールバックする

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/family-share-card.test.tsx tests/components/route-manager-share.test.tsx`
Expected: PASS

**Step 5: Manually verify share behavior**

Run: `npx playwright test tests/responsive/main-app-pages.spec.ts --project='Mobile Chrome - iPhone 12'`
Expected: share CTA is visible and card layout does not overflow on mobile

**Step 6: Commit**

```bash
git add components/report/family-share-card.tsx lib/report-generation/family-share-card.ts components/danger-report/submitted-report-preview.tsx app/report/page.tsx tests/components/family-share-card.test.tsx tests/components/route-manager-share.test.tsx
git commit -m "feat: add family share card for danger reports"
```

### T07: `条件別注意` をダッシュボードへ追加する

**Files:**
- Modify: `components/landing/child-route-dashboard.tsx`
- Create: `lib/route-risk-conditions.ts`
- Modify: `lib/traffic-accident-data.ts`
- Test: `tests/unit/route-risk-conditions.test.ts`
- Test: `tests/components/child-route-dashboard.test.tsx`

**Step 1: Write the failing test**

```ts
it("returns rain and dusk warnings for a route", () => {
  expect(buildRouteRiskConditions({ hasRainRisk: true, hasDuskRisk: true })).toEqual([
    "雨の日に注意",
    "薄暮に注意",
  ])
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/route-risk-conditions.test.ts`
Expected: FAIL because the helper does not exist

**Step 3: Write minimal implementation**

- 条件ラベル生成ヘルパーを追加する
- ダッシュボードで `雨`, `薄暮`, `交通量` など最大2件だけ表示する

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/route-risk-conditions.test.ts tests/components/child-route-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/landing/child-route-dashboard.tsx lib/route-risk-conditions.ts lib/traffic-accident-data.ts tests/unit/route-risk-conditions.test.ts tests/components/child-route-dashboard.test.tsx
git commit -m "feat: add conditional route warnings to dashboard"
```

### T08: 週次の通学路サマリー通知を追加する

**Files:**
- Create: `app/api/notifications/weekly-route-summary/route.ts`
- Modify: `components/notifications/notification-list.tsx`
- Modify: `hooks/use-notifications.ts`
- Modify: `lib/types.ts`
- Test: `tests/notifications/notifications.spec.ts`

**Step 1: Write the failing test**

```ts
test("weekly route summary notification links back to landing dashboard", async () => {
  expect(buildWeeklyRouteSummaryNotification({ routeId: "route-1" }).link).toBe("/landing?quickCheck=route-1")
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/notifications/notifications.spec.ts`
Expected: FAIL because the weekly notification type does not exist

**Step 3: Write minimal implementation**

- 週次サマリー通知型を追加する
- `notification_list` からランディング上部のクイックチェックへ戻せるリンクを付与する
- 通知文面は `今週の通学路で注意したい3地点` のような親向けコピーにする

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/notifications/notifications.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/notifications/weekly-route-summary/route.ts components/notifications/notification-list.tsx hooks/use-notifications.ts lib/types.ts tests/notifications/notifications.spec.ts
git commit -m "feat: add weekly route summary notifications"
```

### T09: KPI イベントを最低限計測できるようにする

**Files:**
- Create: `app/api/analytics/ux-events/route.ts`
- Create: `lib/analytics/ux-events.ts`
- Modify: `components/landing/child-route-dashboard.tsx`
- Modify: `components/danger-report/submitted-report-preview.tsx`
- Modify: `components/report/family-share-card.tsx`
- Test: `tests/tech/error-handling.spec.ts`

**Step 1: Write the failing test**

```ts
it("serializes ux events with feature and action names", () => {
  expect(buildUxEvent("family_share_card_shared", { source: "post_submit" })).toEqual({
    event: "family_share_card_shared",
    meta: { source: "post_submit" },
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ux-events.test.ts`
Expected: FAIL because the event helper does not exist

**Step 3: Write minimal implementation**

- `dashboard_viewed`, `simulation_previewed`, `report_submitted`, `family_share_card_shared` の4イベントだけ送る
- API は失敗しても UI を止めない
- DB が未整備でも受信ログだけ残せる形にする

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ux-events.test.ts tests/tech/error-handling.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/analytics/ux-events/route.ts lib/analytics/ux-events.ts components/landing/child-route-dashboard.tsx components/danger-report/submitted-report-preview.tsx components/report/family-share-card.tsx tests/unit/ux-events.test.ts tests/tech/error-handling.spec.ts
git commit -m "feat: add ux funnel event logging"
```

## Recommended Delivery Order

1. T01 ホームユニット
2. T02 ダッシュボードデータ
3. T03 報告導線の文脈修正
4. T04 投稿前プレビュー
5. T05 投稿完了画面
6. T06 家族共有カード
7. T07 条件別注意
8. T08 週次通知
9. T09 KPI 計測

## Risks

- 投稿完了後の情報量が増えすぎると、かえって完了体験が重く見える
- 共有カード画像化は端末差異が出やすいため、まずは固定レイアウトを優先する
- ダッシュボードはニュース型ホームを壊さないことが最重要であり、高さを伸ばしすぎない
- KPI 計測はアプリの主要導線を止めないことを優先する

## Notes

- `守れた家庭数` は実装しない
- ホームはニュース型のまま維持する
- PTA / 学校提出向け強化は Phase 2 以降へ送る
