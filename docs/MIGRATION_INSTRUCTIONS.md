# データベースマイグレーション手順

## ステップ1: Supabase SQL Editorを開く

1. Supabaseダッシュボードにアクセス: https://supabase.com/dashboard
2. プロジェクトを選択
3. 左サイドバーから「SQL Editor」をクリック
4. 「New query」をクリック

## ステップ2: SQLマイグレーションを実行

1. `database-migration-report-gallery-feed.sql` ファイルを開く
2. ファイルの内容をすべてコピー
3. Supabase SQL Editorに貼り付け
4. 「Run」ボタンをクリック

## ステップ3: マイグレーションが成功したか確認

マイグレーションが成功すると、以下のテーブルが作成されます：

- `report_bookmarks` - お気に入り
- `report_likes` - いいね
- `report_comments` - コメント
- `report_shares` - シェア
- `report_notifications` - 通知

確認方法：
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'report_%';
```

## ステップ4: テストを実行

マイグレーション後、以下のコマンドでテストを実行：

```bash
npm run test:db-migration
```

## 期待される結果

### テーブルとビューの作成
- ✅ 5つのテーブルが作成される
- ✅ 4つのビューが作成される

### Helper関数
- ✅ `toggle_report_bookmark()` - お気に入りのON/OFF
- ✅ `toggle_report_like()` - いいねのON/OFF
- ✅ `get_user_bookmarked_reports()` - ブックマーク一覧
- ✅ `get_trending_reports()` - トレンド報告
- ✅ `get_report_comments()` - コメント一覧

### RLS (Row Level Security)
- ✅ すべてのテーブルでRLSが有効
- ✅ 適切なポリシーが設定される

## トラブルシューティング

### エラー: "permission denied"
- Supabaseダッシュボードの管理者権限で実行していることを確認
- SQL Editorで実行していることを確認

### エラー: "relation already exists"
- テーブルが既に存在する場合は、`DROP TABLE IF EXISTS` を使用して削除してから再実行
- または、`CREATE TABLE IF NOT EXISTS` がすでに含まれているので、そのまま実行しても問題ありません

### エラー: "function does not exist"
- `update_updated_at_column()` 関数が存在しない場合:
  ```sql
  CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

## 次のステップ

マイグレーションが成功したら：

1. **データの確認**
   ```sql
   -- テーブルの確認
   SELECT * FROM report_bookmarks LIMIT 5;
   SELECT * FROM report_likes LIMIT 5;
   SELECT * FROM report_comments LIMIT 5;

   -- 統計の確認
   SELECT * FROM report_stats LIMIT 5;
   SELECT * FROM danger_category_stats;
   ```

2. **アプリケーションのテスト**
   - ブラウザでアプリケーションを開く
   - お気に入り機能をテスト
   - いいね機能をテスト
   - コメント機能をテスト

3. **パフォーマンスの確認**
   - インデックスが正しく作成されているか確認
   - クエリのパフォーマンスを確認

## サポート

問題が発生した場合は、以下を確認してください：

1. Supabaseのバージョン
2. PostgreSQLのバージョン
3. エラーメッセージの全文
4. 実行したSQLクエリ
