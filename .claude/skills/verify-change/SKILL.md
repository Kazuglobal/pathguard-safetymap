---
name: verify-change
description: コード変更を「完了」と報告する前に必ず通す検証ゲート(mapsefe/20250615=PathGuardian専用・具体版)。編集成功だけを根拠に完了報告せず、このリポジトリの実コマンドを実行し実出力を証拠として添える。
---

# 変更の検証ゲート(PathGuardian専用)

編集が成功しただけでは「完了」ではない。完了報告の前に以下を実行し、**実際のコマンド出力**を証拠として報告に含めること。コマンドは推測せず、このリポジトリでは常に以下を使う。

## 1. 型・静的チェック(全変更で必須)

```
npm run typecheck
```
(`tsc --noEmit`。エラー0件であること)

## 2. テスト(全変更で必須)

- 変更に関連するテストを対象を絞って実行: `npx vitest run <対象パス>`
- ユニット/lib全体: `npm run test:unit`
- コンポーネント全体: `npm run test:components`
- 新しい関数・hook・APIルートを追加したら、同じ変更内にテストを追加してから緑を確認する
- リファクタは先に characterization テストで現状の振る舞いを固定してから着手する
- バグ修正は再現テストを先に書く(RED を確認してから直す)

## 3. ビルド(該当時のみ)

ルート構成・next.config・vercel.json・DBスキーマに触れた場合のみ:
```
npm run build
```
`scripts/validate-env.js` が環境変数の**存在確認**を行う(値は出力しない)。失敗した場合、不足している変数名だけを報告し、値は絶対に出力・echoしない。

## 4. E2E / Playwright(該当時のみ)

- レスポンシブ/ブラウザ横断の見た目・操作に関わる変更: `npm run test:responsive`
  - 端末別に絞る場合: `npm run test:responsive:mobile` / `:tablet` / `:desktop`
- APIルートの契約変更: `npm run test:api`

## 5. クリティカルフロー個別チェック(該当する変更のみ・グローバル版にはない具体版)

変更が以下のいずれかに触れる場合、対応するテストを必ず実行してから完了報告する:

| 触れた領域 | 実行するテスト |
|---|---|
| 危険報告の投稿→承認→公開表示(`danger_reports` の status 遷移、`PUBLIC_DANGER_REPORT_STATUSES`) | `npx vitest run tests/components/route-danger-report-dialog.test.tsx` + `lib/danger-report-status.ts` を参照する unit test 一式 |
| 画像アクセス(署名URL) | 生の公開URLを `<img>` やAPIレスポンスに直接使うコードを追加していないか(`lib/danger-report-image-access.ts` 経由か)を目視確認。該当テストなし・目視必須 |
| レポート生成(PDF/PNG/JPEG) | `npx vitest run tests/unit/lib/report-generation` |
| 危険レベル表示 | `npx vitest run tests/unit/lib/report-generation/danger-level-presentation.test.ts` |
| 地図ピンの重なり・採番 | `npx vitest run tests/unit/lib/report-generation/spread-markers.test.ts` |
| 家族共有カード | `npx vitest run tests/unit/lib/report-generation/family-share-card.test.ts tests/components/family-share-card.test.tsx` |
| プッシュ通知(daily digest 等) | `npx vitest run tests/unit/hooks/use-push-subscription.test.ts` |
| 不審者アラート・モデレーション(`app/api/suspicious-alert/moderate/route.ts`) | サーバ側 `moderateSuspiciousAlertWithAi`(`lib/suspicious-alert-moderation-ai.ts`)経由のままか目視確認。クライアント側のみの判定に戻すコードを混入させない |

## 6. マイグレーション(自動実行しない)

`npm run apply-migration` はDBに直接書き込む。検証ゲートの一環として**自動実行せず**、実行が必要な場合は内容をユーザーに提示して確認を取ってから行う。

## 7. コミット前チェック

- 変更ファイルに `console.log` / デバッグ出力が残っていない
- ハードコードされたシークレット・APIキーがない
- `.env` / `.env.local` の値をコンテキストやログに出力していない(CLAUDE.mdの禁止事項)
- ユーザー入力を受ける新規コードはバリデーションしている(zod 等)

## 禁止手段(検証を通すための偽装)

- テストの skip・削除・アサーション弱体化で緑にする
- タイムアウト延長やリトライ追加で症状を隠す
- catch で握りつぶしてエラーを見えなくする

いずれかのステップが失敗したら、根因を特定して修正し、**ステップ1から**再実行する。部分的に検証済みの状態で作業を返さない。

## 完了報告の形式

```
【検証結果】
- typecheck: エラー0 (実出力の末尾を引用)
- test: X passed / 0 failed (実出力を引用、対象パス明記)
- (該当時) build / test:responsive / test:api の結果
- (該当時) クリティカルフロー個別チェックの結果
```
