# Push Notification Hardening Design

**作成日:** 2026-03-21
**ステータス:** 承認済み

---

## Goal

Web Push 通知実装の release blocker を解消する。対象は以下の 3 点。

1. 任意 `reportId` を使った危険レポート通知の再送を防ぐ
2. 即時送信と cron 補完の二重経路による重複通知を防ぐ
3. 既存購読の通知設定をクライアントに復元し、更新失敗時にローカル状態が壊れないようにする

---

## Approach

### 1. 危険レポート通知の権限制御

- `/api/push/notify-danger-report` は「投稿者本人の新規レポート通知確定」専用にする
- `danger_reports.id` に加えて `danger_reports.user_id = auth user` を必須にする
- 任意の既存レポート ID を投げても通知処理に入れない

### 2. 危険レポート通知の重複防止

- `danger_reports.push_notified_at` を追加する
- 通知送信前に `push_notified_at IS NULL` 条件付き UPDATE で claim する
- claim に成功した処理だけが送信する
- 送信中に失敗した場合は claim をロールバックして cron で再試行可能にする
- cron は `push_notified_at IS NULL` の recent report のみを対象にする

### 3. 購読設定の hydrate と更新整合性

- `GET /api/push/subscribe?endpoint=...` を追加する
- `usePushSubscription` 初期化時に既存ブラウザ subscription の endpoint を使って保存済み設定を取得する
- `PATCH /api/push/subscribe` が失敗したときは optimistic update をロールバックする
- endpoint 単位で設定を扱い、別端末の設定とは混線させない

---

## Testing Strategy

- API unit test:
  - 他人のレポート / 既送信レポート / 初回送信を区別する
  - subscribe GET の hydrate 応答を検証する
- Hook unit test:
  - 既存 subscription の設定が hydrate される
  - 設定更新 API が失敗したら preferences が元に戻る
- Notification unit test:
  - claim 済みレポートは送信対象にならない
  - claim 失敗時に重複送信しない

---

## Files

- Modify: `app/api/push/notify-danger-report/route.ts`
- Modify: `app/api/cron/push-danger-reports/route.ts`
- Modify: `app/api/push/subscribe/route.ts`
- Modify: `hooks/use-push-subscription.ts`
- Modify: `lib/push-notifications/notify-danger-report.ts`
- Modify: `lib/database.types.ts`
- Create: `supabase/migrations/20260321213000_harden_push_notifications.sql`
- Create: `tests/unit/app/api/push/notify-danger-report.test.ts`
- Create: `tests/unit/app/api/cron/push-danger-reports.test.ts`
- Modify: `tests/unit/app/api/push/subscribe.test.ts`
- Modify: `tests/unit/hooks/use-push-subscription.test.ts`
- Modify: `tests/unit/lib/push-notifications/notify-danger-report.test.ts`
