# クイックスタートガイド - データベースマイグレーション

## 🚀 すぐに実行する

### ステップ1: Supabase SQL Editorを開く

1. https://supabase.com/dashboard を開く
2. プロジェクトを選択
3. 左メニューから **SQL Editor** をクリック
4. **New query** をクリック

### ステップ2: SQLを実行

1. `database-migration-report-gallery-feed.sql` を開く
2. **すべての内容をコピー** (Ctrl+A → Ctrl+C)
3. Supabase SQL Editor に **貼り付け** (Ctrl+V)
4. **Run** ボタンをクリック ▶️

### ステップ3: 成功を確認

✅ 以下のメッセージが表示されれば成功：
```
Success. No rows returned
```

または

```
COMMIT
```

## ❌ エラーが出た場合

### エラー: "already exists"
→ **問題ありません！** すでに一部が作成済みです。
→ SQLファイルには `DROP ... IF EXISTS` が含まれているので、もう一度実行してください。

### エラー: "permission denied"
→ Supabaseダッシュボードの管理者権限で実行していることを確認

### エラー: "relation does not exist"
→ `danger_reports` テーブルが存在することを確認
→ 先に他のマイグレーションを実行する必要があるかもしれません

## ✅ 実行後の確認

```sql
-- テーブルが作成されたか確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'report_%'
ORDER BY table_name;
```

期待される結果：
- report_bookmarks
- report_comments
- report_likes
- report_notifications
- report_shares

## 🧪 テストを実行

```bash
npm run test:db-migration
```

## 📄 作成される機能

### テーブル (5個)
- ✅ `report_bookmarks` - お気に入り
- ✅ `report_likes` - いいね
- ✅ `report_comments` - コメント
- ✅ `report_shares` - シェア追跡
- ✅ `report_notifications` - 通知

### ビュー (4個)
- ✅ `report_stats` - 統計情報
- ✅ `public_reports_with_stats` - 公開報告+統計
- ✅ `danger_category_stats` - カテゴリー統計
- ✅ `user_report_activity` - ユーザーアクティビティ

### Helper関数 (5個)
- ✅ `toggle_report_bookmark()` - お気に入りON/OFF
- ✅ `toggle_report_like()` - いいねON/OFF
- ✅ `get_user_bookmarked_reports()` - ブックマーク一覧
- ✅ `get_trending_reports()` - トレンド報告
- ✅ `get_report_comments()` - コメント一覧

### RLSポリシー (11個)
- ✅ すべてのテーブルでRow Level Securityが有効
- ✅ ユーザーは自分のデータのみ変更可能
- ✅ 公開データは誰でも閲覧可能

## 🔄 再実行が必要な場合

マイグレーションは **何度でも安全に再実行** できます：
- `IF NOT EXISTS` - テーブルが存在しない場合のみ作成
- `DROP ... IF EXISTS` - 既存のポリシー/トリガーを削除してから作成
- `CREATE OR REPLACE` - 関数とビューを上書き

## 📞 サポートが必要な場合

詳細なドキュメント：
- `DATABASE_GALLERY_FEED_README.md` - 完全なAPIドキュメント
- `MIGRATION_INSTRUCTIONS.md` - 詳細な手順

問題がある場合は、エラーメッセージ全文をコピーして確認してください。
