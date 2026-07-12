# PathGuardian UX改善 実装・検証レポート

実施日: 2026-07-11  
正本: `implementation-instructions.md`、承認済み監査・比較画像、`lib/design/tanken.ts`

## 1. 実装結果

### Critical

- 認証・権限: ログインの `next` を安全に保持し、認証後に目的ルートへ戻す。一般ユーザーの管理画面アクセスは、理由と戻り先を持つ `/access-denied` へ送る。既知のローカル管理者テストユーザーは管理3画面へ到達できる。
- ダッシュボード: `/dashboard` の地図転送を廃止し、ポイント、最近の報告、審査中件数、報告履歴、次の行動を表示する本人用画面に変更。
- 危険報告: `/report` 上部に3ステップ説明、主CTA、現在地CTA、地図への代替導線を追加し、既存ウィザードと送信処理を再利用。成功状態に報告ID、審査状態、地図／履歴への戻り先を追加。
- 通学路クイズ: 390pxで地図を全幅・画面高約52%にし、2回の地図タップを番号付きスタート／ゴールへ確実に反映。2点選択後だけ開始可能にし、やり直しと読み込み失敗時の回復を追加。

### High

- 地図: ベース地図・危険マーカー・ユーザー情報を段階表示し、読み込み中も一覧と再試行を利用可能にした。地図未準備時の報告不可理由も表示。
- きけんハンター: 写真処理中を安全なぼかしプレビュー、`しゃしんを じゅんび中 2/3`、匿名化説明、再試行／写真変更で表示。12秒タイムアウトと Object URL・タイマー・検出器のクリーンアップを追加。
- 登録／パスワード再設定: 必須チップ、リアルタイムパスワード条件、フィールド直下エラー、重複メールからログインへの回復、最初のエラーへのフォーカス、送信中状態、レート制限／通信失敗の区別を追加。

### Medium

- ランキング: 0件時に承認文言、最初の10pt CTA、3つのポイント獲得タスクを追加。
- Missions／Badges: 未完了ミッションの残り回数と開始リンク、次バッジまでの残りポイントとミッション導線を追加。
- オンボーディング: 深いリンクを塞がず、ログイン済みの `/landing` だけで1画面要約を表示。`あとで見る`、地図CTA、44pxページ操作対象を実装。
- News／Safe Magazine: 既存実装に一覧復帰リンクがあり、追加変更なし。

## 2. 主な変更ファイル

- 認証・権限: `middleware.ts`、`lib/auth/safe-next.ts`、`lib/admin.ts`、`app/login/page.tsx`、`app/auth/callback/route.ts`、`app/admin/layout.tsx`、`app/access-denied/page.tsx`
- Dashboard: `app/dashboard/page.tsx`、`components/dashboard/user-dashboard.tsx`
- Report: `app/report/page.tsx`、`components/danger-report/report-composer.tsx`、`components/danger-report/danger-report-form.tsx`
- Route quiz: `app/route-quiz/page.tsx`、`lib/route-quiz-selection.ts`
- Map: `components/map/map-container.tsx`、`map-floating-controls.tsx`、`map-status-overlays.tsx`
- Hunter: `components/safety-quest/hunter/mask-confirm.tsx`
- Forms: `components/auth/register-form.tsx`、`app/forgot-password/page.tsx`
- Empty states: `app/leaderboard/page.tsx`、`app/missions/page.tsx`、`app/badges/page.tsx`
- Onboarding: `components/onboarding/app-onboarding.tsx`、`app-onboarding-gate.tsx`
- Tests: `tests/unit/lib/{admin-auth,safe-next,route-quiz-selection}.test.ts` と関連コンポーネントテスト

## 3. browser-use 実操作結果

ビューポートは各遷移後に 390×844 または 1280×900 へ設定し、最低6秒（地図は追加待機）後に撮影した。

| タスク | 390×844 | 1280×900 | 結果 |
|---|---|---|---|
| next付きログイン→本人Dashboard | [ログイン](implementation-evidence-2026-07-11/01-login-mobile-before.png) / [Dashboard](implementation-evidence-2026-07-11/04b-dashboard-mobile-correct.png) | [ログイン](implementation-evidence-2026-07-11/19b-login-desktop-next.png) / [Dashboard](implementation-evidence-2026-07-11/20-dashboard-desktop-next-success.png) | `/dashboard` 到達 |
| 危険報告CTA→ウィザード | [開始前](implementation-evidence-2026-07-11/05-report-mobile-initial.png) / [開始後](implementation-evidence-2026-07-11/06-report-mobile-wizard-open.png) | [Desktop](implementation-evidence-2026-07-11/21-report-desktop.png) | 主CTAから既存ウィザード起動 |
| 通学路クイズ2点選択 | [初期](implementation-evidence-2026-07-11/07-route-quiz-mobile-initial.png) / [2点](implementation-evidence-2026-07-11/08-route-quiz-mobile-two-points.png) / [開始操作](implementation-evidence-2026-07-11/09-route-quiz-mobile-action-enabled.png) | [Desktop](implementation-evidence-2026-07-11/23-route-quiz-desktop.png) | 2回タップで番号ピンと開始状態を確認 |
| 地図読み込み・操作可能状態 | [Mobile](implementation-evidence-2026-07-11/11b-map-mobile-ready-after-explicit-wait.png) | [Desktop](implementation-evidence-2026-07-11/22-map-desktop-ready.png) | 地図、マーカー、一覧、報告CTAを確認 |
| きけんハンター写真選択 | [初期](implementation-evidence-2026-07-11/12-hunter-mobile-initial.png) / [匿名化確認](implementation-evidence-2026-07-11/13-hunter-mobile-processing.png) | [Desktop](implementation-evidence-2026-07-11/29-hunter-desktop.png) | ファイル添付から安全確認へ進行 |
| 登録エラー回復 | [条件表示](implementation-evidence-2026-07-11/14b-register-mobile-checklist.png) / [重複回復](implementation-evidence-2026-07-11/15-register-mobile-duplicate-recovery.png) | [Desktop](implementation-evidence-2026-07-11/28-register-desktop.png) | 重複メールとログイン導線を確認 |
| パスワード再設定エラー | [Mobile](implementation-evidence-2026-07-11/16-forgot-mobile-inline-error.png) | — | 日本語インラインエラーを確認 |
| ランキング0件 | [Mobile](implementation-evidence-2026-07-11/17-leaderboard-mobile.png) | [Desktop](implementation-evidence-2026-07-11/30-leaderboard-desktop.png) | CTAと3タスクを確認 |
| 1画面オンボーディング | [Mobile](implementation-evidence-2026-07-11/18b-onboarding-summary-mobile-authenticated.png) | — | `/landing` のみ、1枚＋あとで見るを確認 |
| 一般ユーザーの管理画面アクセス | — | [拒否画面](implementation-evidence-2026-07-11/24-admin-access-denied-desktop.png) | 理由と戻り先を確認 |
| 管理者3画面 | — | [Dashboard](implementation-evidence-2026-07-11/25-admin-dashboard-desktop.png) / [Reports](implementation-evidence-2026-07-11/26-admin-reports-desktop.png) / [Costs](implementation-evidence-2026-07-11/27-admin-costs-desktop.png) | `admin@test.com` で3ルート到達 |

## 4. 自動検証

- Node.js: 20.19.4
- `pnpm typecheck`: 成功
- `pnpm test:unit`: 134 files / 1178 tests 成功
- 変更対象コンポーネントテスト: 8 files / 21 tests 成功
- 変更対象のESLint: 成功（既存 `.eslintrc.json` を使うため `ESLINT_USE_FLAT_CONFIG=false` を指定）
- `pnpm build`: 成功、73ページを生成
- 変更対象の `git diff --check`: 成功

## 5. 残課題・既存警告

- `pnpm lint` スクリプト自体は Next.js 16 で廃止された `next lint` を呼ぶ既存設定のため失敗する。今回の変更対象は ESLint CLI のレガシー設定指定で検査済み。package scriptの移行は本タスク外として変更していない。
- Buildでは既存の Sentry/Turbopack 警告、`middleware`→`proxy` 非推奨警告、`metadataBase` 未設定警告が出る。いずれもビルドは成功し、今回のUX実装とは独立している。
- 外部AI、実メール、実通知、危険報告のDB送信は行っていない。データ移行は不要。
- 無関係な既存変更、`.env*`、本番環境、commit、push、deployには触れていない。
