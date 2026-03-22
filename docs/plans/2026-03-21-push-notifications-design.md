# Push Notification Design Document

**作成日:** 2026-03-21
**ステータス:** 実装済み

---

## 概要

通学路周辺の安全情報をプッシュ通知で届ける機能。

| 通知タイプ | トリガー | 対象 |
|-----------|---------|------|
| 危険レポートアラート | 登録通学路300m圏内に新規レポート投稿 | 当該ルート登録ユーザー |
| ニュースアラート | 通学路ニュース記事追加時 | 全購読ユーザー |
| マガジンアラート | 安全マガジン記事公開時 | 全購読ユーザー |

---

## アーキテクチャ

### 技術選択: Web Push API + VAPID

- Firebase Cloud Messaging 不要 — Web Push API はブラウザネイティブでクロスブラウザ対応
- VAPID (Voluntary Application Server Identification) で認証
- `web-push` npm パッケージで Node.js/Vercel Functions から送信
- **サポートブラウザ:** Chrome 50+, Firefox 44+, Edge 17+, Safari 16.4+ (macOS/iOS)

### システム構成図

```
[ブラウザ]                [Vercel/Next.js]           [Supabase]
  │                           │                          │
  ├─ SW登録 (/sw.js)          │                          │
  ├─ 通知許可リクエスト        │                          │
  ├─ POST /api/push/subscribe ──→ push_subscriptions INSERT
  │                           │                          │
  │  危険レポート投稿時:        │                          │
  ├─ danger_reports INSERT ───→ (Supabase直接)            │
  ├─ POST /api/push/notify-danger-report ──→ notifyUsersNearRoute()
  │                           │                 ├─ user_routes 取得
  │                           │                 ├─ 300mバッファ判定
  │                           │                 └─ push_subscriptions 取得
  │                           ├─ webpush.sendNotification() ──→ Push Service
  │                           └─ notifications INSERT        │
  │                                                          │
  │  Cron (15分毎):            │                             │
  │                  /api/cron/push-danger-reports ──→ 同上  │
  │                                                          │
  │  ニュース/マガジン更新時:   │                             │
  │                  POST /api/push/notify-content ──→ broadcastPush()
  │                                                          │
[Push Service]◄─────────────── webpush.sendNotification()   │
  │                                                          │
  └──→ SW push event ──→ showNotification()
```

---

## データベース設計

### `push_subscriptions` テーブル

```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  notification_preferences jsonb NOT NULL DEFAULT '{
    "danger_reports": true,
    "news": true,
    "magazine": true
  }'::jsonb,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
```

**RLS ポリシー:** ユーザーは自分のサブスクリプションのみ操作可能

---

## API設計

| エンドポイント | メソッド | 認証 | 説明 |
|-------------|--------|------|------|
| `/api/push/subscribe` | POST | ログイン必須 | サブスクリプション登録 |
| `/api/push/subscribe` | PATCH | ログイン必須 | 通知設定更新 |
| `/api/push/unsubscribe` | DELETE | ログイン必須 | サブスクリプション解除 |
| `/api/push/notify-danger-report` | POST | ログイン必須 | 危険レポートアラート送信 |
| `/api/push/notify-content` | POST | CRON_SECRET | ニュース/マガジンアラート送信 |
| `/api/cron/push-danger-reports` | GET | CRON_SECRET | Cron安全網 (15分毎) |

---

## プッシュペイロード設計

```typescript
interface PushPayload {
  title: string
  body: string
  icon: string
  badge: string
  tag: string       // 重複排除タグ
  data: {
    url: string     // クリック時の遷移先
    type: 'danger_reports' | 'news' | 'magazine'
  }
}
```

---

## 環境変数

```bash
# VAPID keys (npx web-push generate-vapid-keys で生成)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<base64url公開鍵>
VAPID_PRIVATE_KEY=<base64url秘密鍵>
VAPID_SUBJECT=mailto:admin@pathguardian.jp

# Cron認証 (既存のCRON_SECRETを流用)
CRON_SECRET=<32バイトランダムhex>
```

---

## セキュリティ考慮事項

| リスク | 対策 |
|--------|------|
| VAPID秘密鍵漏洩 | サーバー環境変数のみ (NEXT_PUBLIC_ は公開鍵のみ) |
| 他ユーザーのサブスクリプション操作 | RLS + user_id = auth.uid() チェック |
| `/api/push/notify-content` への不正アクセス | CRON_SECRET bearer token 認証 |
| サブスクリプション重複登録 | UNIQUE(user_id, endpoint) 制約 |
| 期限切れサブスクリプション | 410/404レスポンス時に自動削除 |
| 通知スパム | コンテンツ通知は同typeで1時間以内の再送防止 |
