# Push Notification Implementation Plan

**作成日:** 2026-03-21
**ステータス:** 実装済み

---

## 前提条件

- `web-push` npm パッケージをインストール済み ✅
- 設計ドキュメント (`2026-03-21-push-notifications-design.md`) を確認済み ✅

## 環境変数セットアップ

VAPID鍵を生成して `.env.local` に追加:

```bash
npx web-push generate-vapid-keys
```

`.env.local` に以下を追加:
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<生成した公開鍵>
VAPID_PRIVATE_KEY=<生成した秘密鍵>
VAPID_SUBJECT=mailto:admin@pathguardian.jp
CRON_SECRET=<32バイトランダムhex>
```

---

## Phase 1: Foundation ✅

- [x] Step 1.1: `web-push` + `@types/web-push` インストール
- [x] Step 1.2: `supabase/migrations/20260321000000_add_push_subscriptions.sql`
- [x] Step 1.3: `public/sw.js` (Service Worker)
- [x] Step 1.4: `lib/notifications/builders.ts` + `hooks/use-notifications.ts` 更新
- [x] Step 1.5: `lib/web-push.ts`
- [x] Step 1.6: `app/api/push/subscribe/route.ts` + `app/api/push/unsubscribe/route.ts`
- [x] Step 1.7: `tests/unit/lib/web-push.test.ts` + `tests/unit/app/api/push/subscribe.test.ts`

---

## Phase 2: 危険レポートアラート ✅

- [x] Step 2.1: `lib/push-notifications/notify-danger-report.ts`
- [x] Step 2.2: `app/api/push/notify-danger-report/route.ts`
- [x] Step 2.3: `components/map/map-container.tsx` 修正 (fire-and-forget)
- [x] Step 2.4: `app/api/cron/push-danger-reports/route.ts` + `vercel.json` 更新
- [x] Step 2.5: `tests/unit/lib/push-notifications/notify-danger-report.test.ts`

---

## Phase 3: ニュース・マガジンアラート ✅

- [x] Step 3.1: `app/api/push/notify-content/route.ts`
- [x] Step 3.3: `tests/unit/app/api/push/notify-content.test.ts`

---

## Phase 4: UI ✅

- [x] Step 4.1: `hooks/use-push-subscription.ts`
- [x] Step 4.2: `components/notifications/push-permission-prompt.tsx`
- [x] Step 4.3: `components/notifications/push-settings-panel.tsx`
- [x] Step 4.4: `app/mypage/page.tsx` + `components/providers/layout-provider.tsx` 修正
- [x] Step 4.5: テストファイル各種

---

## 変更ファイル一覧

### 新規作成 (22ファイル)
```
supabase/migrations/20260321000000_add_push_subscriptions.sql
public/sw.js
lib/notifications/builders.ts
lib/web-push.ts
lib/push-notifications/notify-danger-report.ts
app/api/push/subscribe/route.ts
app/api/push/unsubscribe/route.ts
app/api/push/notify-danger-report/route.ts
app/api/push/notify-content/route.ts
app/api/cron/push-danger-reports/route.ts
hooks/use-push-subscription.ts
components/notifications/push-permission-prompt.tsx
components/notifications/push-settings-panel.tsx
tests/unit/lib/web-push.test.ts
tests/unit/lib/push-notifications/notify-danger-report.test.ts
tests/unit/app/api/push/subscribe.test.ts
tests/unit/app/api/push/notify-content.test.ts
tests/unit/hooks/use-push-subscription.test.ts
tests/components/notifications/push-permission-prompt.test.tsx
tests/components/notifications/push-settings-panel.test.tsx
docs/plans/2026-03-21-push-notifications-design.md
docs/plans/2026-03-21-push-notifications-plan.md
```

### 修正 (5ファイル)
```
hooks/use-notifications.ts          - lib/notifications/builders.ts から re-export
components/map/map-container.tsx    - 危険レポートINSERT後にpush通知 fire-and-forget
app/mypage/page.tsx                  - PushSettingsPanel 追加
components/providers/layout-provider.tsx - PushPermissionPrompt 追加
vercel.json                          - cron設定追加
```

---

## ローカル検証手順

1. `.env.local` にVAPID鍵とCRON_SECRETを設定
2. `pnpm dev` でサーバー起動
3. `/mypage` でプッシュ通知設定カードを確認
4. 「通知を許可する」ボタンをクリック → ブラウザの通知許可ダイアログ
5. 許可後、危険レポートを地図上で投稿
6. プッシュ通知が届くことを確認

## テスト実行

```bash
pnpm test tests/unit/lib/web-push.test.ts
pnpm test tests/unit/lib/push-notifications/
pnpm test tests/unit/app/api/push/
pnpm test tests/unit/hooks/use-push-subscription.test.ts
pnpm test tests/components/notifications/
```
