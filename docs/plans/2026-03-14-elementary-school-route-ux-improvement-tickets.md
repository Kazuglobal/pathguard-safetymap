# Elementary School Route UX Improvement Tickets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 小学生の親向け通学路安全確認アプリを、`短時間で信頼できる安全判断ができる` 体験に寄せるための改善チケットへ分解する。

**Architecture:** 既存の `routes` / `map` / `hazard` 機能を活かしつつ、まずはホームサマリーと根拠表示で「判断の速さ」と「信頼性」を補強する。次にルート作成負荷とモバイルUIを整理し、その後に比較、共有、学校連携などの横展開機能を追加する。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase, Mapbox GL, Vitest, Playwright

---

## Backlog Summary

### P0

- [x] T01 安全サマリーカードを追加する
- [x] T02 危険箇所の根拠と更新日時を表示する
- [x] T03 初回オンボーディングを追加する
- [x] T04 ルート登録を簡略化する
- [x] T05 モバイルの情報設計と操作導線を整理する

### P1

- [x] T06 ルート比較画面を追加する
- [x] T07 危険箇所を一覧と地図の両方で見せる
- [x] T08 家族共有導線を追加する
- [x] T09 子どもごとの通学路管理に対応する
- [ ] T10 条件別リスク表示を追加する

### P2

- [ ] T11 学校推奨ルート比較を追加する（不要のため実施しない）
- [x] T12 危険箇所の保護者報告と通知の基盤を整える

## Ticket Details

### T01: 安全サマリーカードを追加する

**目的:** 親がアプリを開いて数秒で `今日の通学路は安全 / 注意 / 要確認` を判断できるようにする。

**優先度:** P0

**関連ファイル:**
- Modify: `app/map/page.tsx`
- Modify: `components/map/map-page-client.tsx`
- Modify: `components/map/route-hazard-panel.tsx`
- Modify: `hooks/use-route-dangers.ts`
- Modify: `lib/safety-scoring/route-safety-scorer.ts`
- Create: `components/map/route-safety-summary-card.tsx`
- Test: `tests/components/map/route-hazard-panel.test.tsx`
- Test: `tests/unit/hooks/use-route-dangers.test.ts`
- Test: `tests/responsive/map-ui-layout.spec.ts`

**TODO:**
- [x] 安全サマリーカードの表示位置を決める
- [x] 既存ハザード判定から summary 用データを組み立てる
- [x] 判定ステータスを `安全 / 注意 / 要確認` の3段階に整理する
- [x] モバイルで最初に見える位置へ配置する
- [x] 状態ごとの見た目を統一する

**受け入れ条件:**
- ルート選択後に一目で安全状態が分かる
- スコアだけでなく簡単な理由文が表示される
- モバイルでスクロールなしに確認できる

### T02: 危険箇所の根拠と更新日時を表示する

**目的:** 危険判定の信頼性を上げ、親が「なぜ危険か」を理解できるようにする。

**優先度:** P0

**関連ファイル:**
- Modify: `components/map/route-hazard-panel.tsx`
- Modify: `components/map/map-sidebar.tsx`
- Modify: `lib/route-hazard-request-state.ts`
- Modify: `lib/traffic-accident-data.ts`
- Modify: `lib/geo/route-danger-finder.ts`
- Create: `components/map/hazard-reason-list.tsx`
- Test: `tests/components/map/route-hazard-panel.test.tsx`
- Test: `tests/unit/lib/geo/route-danger-finder.test.ts`

**TODO:**
- [x] 危険箇所ごとに理由ラベルを定義する
- [x] 更新日時と情報ソースの表示仕様を決める
- [x] 一覧UIを追加する
- [x] 地図上の危険箇所と一覧の対応を取る
- [x] 情報が不足している場合のフォールバック文言を用意する

**受け入れ条件:**
- 主要な危険箇所に理由文が出る
- 更新日時が確認できる
- 情報ソースが視認可能

### T03: 初回オンボーディングを追加する

**目的:** 初回利用者が迷わず価値に到達できるようにする。

**優先度:** P0

**関連ファイル:**
- Modify: `app/map/page.tsx`
- Modify: `components/map/map-page-client.tsx`
- Modify: `components/map/usage-tutorial-dialog.tsx`
- Modify: `lib/tutorial-storage.ts`
- Test: `tests/responsive/main-app-pages.spec.ts`
- Test: `tests/components/map/route-hazard-panel.test.tsx`

**TODO:**
- [x] 初回導線を `ルート選択 -> 安全確認 -> 危険箇所確認` の3ステップで設計する
- [x] スキップ可のチュートリアルを実装する
- [x] 既読状態を保存する
- [x] 再表示導線を用意する

**受け入れ条件:**
- 初回利用者が3ステップ以内で安全確認画面に到達できる
- チュートリアルは後から再表示できる

### T04: ルート登録を簡略化する

**目的:** 通学路登録の初期負荷を下げる。

**優先度:** P0

**関連ファイル:**
- Modify: `app/routes/page.tsx`
- Modify: `components/map/route-manager.tsx`
- Modify: `app/api/mapbox/geocode/route.ts`
- Modify: `app/api/mapbox/directions/route.ts`
- Modify: `hooks/use-user-routes.ts`
- Test: `tests/components/route-manager.test.tsx`
- Test: `tests/routes/routes.spec.ts`
- Test: `tests/unit/hooks/use-user-routes.test.ts`

**TODO:**
- [x] 学校名や住所ベースの開始導線を追加する
- [x] 自動ルートを既定選択にする
- [x] 入力モードの説明を簡潔にする
- [x] 保存前に開始地点と終了地点を要約表示する
- [x] エラー文言を親向けの日本語に整理する

**受け入れ条件:**
- 新規ユーザーが住所検索からルート作成できる
- クリック追加や描画を使わなくても保存まで完了できる
- 失敗時に次の行動が分かる

### T05: モバイルの情報設計と操作導線を整理する

**目的:** 忙しい親が片手で迷わず主要操作を完了できるようにする。

**優先度:** P0

**関連ファイル:**
- Modify: `components/map/map-page-client.tsx`
- Modify: `components/map/map-floating-controls.tsx`
- Modify: `components/map/map-sidebar.tsx`
- Modify: `components/map/route-hazard-panel.tsx`
- Modify: `app/globals.css`
- Test: `tests/responsive/map-ui-layout.spec.ts`
- Test: `tests/responsive/main-app-pages.spec.ts`

**TODO:**
- [x] モバイル上の優先情報を `安全サマリー -> 危険箇所 -> 地図` に並べ替える
- [x] 下部固定または親指到達範囲の操作導線を整理する
- [x] 重複ボタンや分散したトグルを削減する
- [x] 主要CTAの文言を目的ベースに統一する

**受け入れ条件:**
- モバイルで主要操作が片手で完了できる
- 安全確認に不要なUIが初期表示で目立たない

### T06: ルート比較画面を追加する

**目的:** 親が複数ルートを `安全性 / 距離 / 所要時間` で比較できるようにする。

**優先度:** P1

**関連ファイル:**
- Modify: `app/routes/page.tsx`
- Modify: `components/map/route-manager.tsx`
- Modify: `components/routes/route-card.tsx`
- Modify: `lib/safety-scoring/route-safety-scorer.ts`
- Create: `components/routes/route-comparison-table.tsx`
- Test: `tests/components/route-card.test.tsx`
- Test: `tests/components/route-manager.test.tsx`

**TODO:**
- [x] 比較対象を複数選択できるようにする
- [x] 安全性、距離、所要時間の比較テーブルを追加する
- [x] 推奨ルートを強調表示する
- [x] 比較結果をモバイルでも読めるようにする

**受け入れ条件:**
- 2つ以上のルートを並べて比較できる
- 比較結果から推奨候補が理解できる

### T07: 危険箇所を一覧と地図の両方で見せる

**目的:** 地図が苦手な親でも危険情報にアクセスできるようにする。

**優先度:** P1

**関連ファイル:**
- Modify: `components/map/map-page-client.tsx`
- Modify: `components/map/map-sidebar.tsx`
- Modify: `components/map/route-hazard-panel.tsx`
- Create: `components/map/route-hazard-list.tsx`
- Test: `tests/components/map/route-hazard-panel.test.tsx`
- Test: `tests/responsive/map-ui-layout.spec.ts`

**TODO:**
- [x] 危険箇所リストを追加する
- [x] 地図上のピンと一覧を相互連動させる
- [x] 重要度順またはルート順で並べ替えられるようにする

**受け入れ条件:**
- 地図を使わなくても危険箇所の一覧を読める
- 一覧選択で地図上の該当箇所に移動できる

### T08: 家族共有導線を追加する

**目的:** 通学路の安全情報を家族間で簡単に共有できるようにする。

**優先度:** P1

**関連ファイル:**
- Modify: `components/map/map-page-client.tsx`
- Modify: `components/routes/route-card.tsx`
- Modify: `lib/types.ts`
- Create: `components/routes/route-share-actions.tsx`
- Test: `tests/components/route-card.test.tsx`
- Test: `tests/responsive/main-app-pages.spec.ts`

**TODO:**
- [x] 共有アクションの入口を追加する
- [x] 共有対象に含める情報を定義する
- [x] モバイル共有シートまたはコピー導線を追加する

**受け入れ条件:**
- 家族へルート名、要注意点、更新日時を共有できる
- モバイルで共有操作が自然に行える

### T09: 子どもごとの通学路管理に対応する

**目的:** 複数の子どもを持つ家庭でも管理しやすくする。

**優先度:** P1

**関連ファイル:**
- Modify: `lib/types.ts`
- Modify: `hooks/use-user-routes.ts`
- Modify: `components/map/route-manager.tsx`
- Modify: `components/routes/route-card.tsx`
- Create: `components/routes/child-selector.tsx`
- Test: `tests/unit/hooks/use-user-routes.test.ts`
- Test: `tests/components/route-manager.test.tsx`

**TODO:**
- [x] ルートに子ども識別子を持たせる設計を追加する
- [x] 子ども切り替えUIを実装する
- [x] 既存ルートへの移行方針を決める

**受け入れ条件:**
- 子どもごとにルートを分けて表示できる
- 他の子どものルートと混同しない

### T10: 条件別リスク表示を追加する

**目的:** 雨天、薄暮、交通量増加など条件差分の不安に対応する。

**優先度:** P1

**関連ファイル:**
- Modify: `components/map/route-hazard-panel.tsx`
- Modify: `lib/safety-scoring/route-safety-scorer.ts`
- Modify: `lib/traffic-accident-data.ts`
- Create: `components/map/risk-condition-filter.tsx`
- Test: `tests/unit/lib/traffic-accident-data.test.ts`
- Test: `tests/components/map/route-hazard-panel.test.tsx`

**TODO:**
- [ ] 条件軸を定義する
- [ ] 条件選択UIを追加する
- [ ] 条件に応じた表示文言を変える

**受け入れ条件:**
- 条件を切り替えると危険表示が変化する
- 親が `今日は特に注意が必要か` を把握できる

### T11: 学校推奨ルート比較を追加する（不要のため実施しない）

**目的:** 保護者判断と学校推奨の差分を分かりやすくする。

**優先度:** P2

**対応方針:** 不要のため実施しない。

**関連ファイル:**
- Modify: `components/routes/route-comparison-table.tsx`
- Modify: `lib/types.ts`
- Create: `components/routes/school-route-badge.tsx`
- Test: `tests/components/route-manager.test.tsx`

**TODO:**
- [ ] 学校推奨ルートのデータ構造を定義する
- [ ] 比較表で推奨ルートを識別できるようにする
- [ ] 差分表示ルールを設計する

**受け入れ条件:**
- 学校推奨ルートとの差分が一覧で分かる

### T12: 危険箇所の保護者報告と通知の基盤を整える

**目的:** 継続利用理由になる `更新性` と `地域連携` を強化する。

**優先度:** P2

**関連ファイル:**
- Modify: `app/report/page.tsx`
- Modify: `components/danger-report/danger-report-form.tsx`
- Modify: `hooks/use-notifications.ts`
- Modify: `components/notifications/notification-list.tsx`
- Test: `tests/components/danger-report/danger-report-form.test.tsx`
- Test: `tests/components/notifications/notification-list.test.tsx`

**TODO:**
- [x] 通学路文脈の危険報告導線を追加する
- [x] 通知対象イベントを定義する
- [x] ルート関連通知の表示文言を設計する

**受け入れ条件:**
- 保護者が危険報告を起点に情報更新へ参加できる
- 通学路関連の注意通知を受け取れる

## Recommended Delivery Order

1. T01 安全サマリーカード
2. T02 危険箇所の根拠と更新日時
3. T03 初回オンボーディング
4. T04 ルート登録簡略化
5. T05 モバイル情報設計
6. T07 危険箇所の一覧表示
7. T06 ルート比較
8. T08 家族共有
9. T09 子どもごとの通学路管理
10. T10 条件別リスク表示
11. T11 学校推奨ルート比較（不要）
12. T12 報告と通知基盤

## Notes

- まずは `判断の速さ` と `信頼性` の改善を優先する
- 共有、学校連携、通知はコアUXが安定してから追加する
- 実装前に、必要なら Supabase のデータ構造確認を行う
