# データベースマイグレーション修正サマリー

## ✅ すべての問題を解決しました！

このドキュメントは、データベースマイグレーション実行時に発生したエラーと、その修正内容をまとめたものです。

---

## 🔧 修正したエラー

### エラー1: 構文エラー（Syntax Error）
```
ERROR: 42601: syntax error at or near "\$"
LINE 105: RETURNS TRIGGER AS \$\$
```

**原因**: エスケープされたドル記号 `\$\$` が使用されていた

**修正内容**: すべての `\$\$` を `$$` に置換
- 影響箇所: 関数定義の開始/終了デリミタ（14箇所）

---

### エラー2: ポリシーの重複エラー
```
ERROR: 42710: policy "Users can view their own bookmarks"
for table "report_bookmarks" already exists
```

**原因**: RLSポリシーがすでに存在していた

**修正内容**: すべてのポリシー作成前に `DROP POLICY IF EXISTS` を追加

影響テーブル：
- ✅ `report_bookmarks` - 3個のポリシー
- ✅ `report_likes` - 3個のポリシー
- ✅ `report_comments` - 4個のポリシー
- ✅ `report_shares` - 2個のポリシー
- ✅ `report_notifications` - 2個のポリシー

**合計**: 14個のポリシーに修正適用

---

### エラー3: 関数の戻り値型変更エラー
```
ERROR: 42P13: cannot change return type of existing function
HINT: Use DROP FUNCTION get_user_bookmarked_reports(uuid) first.
```

**原因**: 既存の関数の戻り値型を変更しようとした

**修正内容**: すべての関数作成前に `DROP FUNCTION IF EXISTS` を追加

影響関数：
- ✅ `toggle_report_bookmark(uuid, uuid)`
- ✅ `toggle_report_like(uuid, uuid)`
- ✅ `get_user_bookmarked_reports(uuid)`
- ✅ `get_trending_reports(integer, integer)`
- ✅ `get_report_comments(uuid)`

**合計**: 5個の関数に修正適用

---

### エラー4: トリガーの重複（潜在的なエラー）
**原因**: トリガーが既に存在していた可能性

**修正内容**: すべてのトリガー作成前に `DROP TRIGGER IF EXISTS` を追加

影響トリガー：
- ✅ `update_report_comments_updated_at`
- ✅ `set_report_comment_edited`

**合計**: 2個のトリガーに修正適用

---

## 📊 最終的なSQLファイルの状態

```
✅ ファイルサイズ: 18KB
✅ 総行数: 488行
✅ BEGIN/COMMIT: 4/4 (バランス取れている)
✅ $$ デリミタ: 14個 (正しいペア)
✅ エスケープされた$: 0個
✅ 構文エラー: なし
```

---

## 🛡️ 冪等性の保証

修正後のマイグレーションは、**何度実行しても安全**です：

| 要素 | 冪等性の保証方法 |
|------|-----------------|
| テーブル | `CREATE TABLE IF NOT EXISTS` |
| インデックス | `CREATE INDEX IF NOT EXISTS` |
| ビュー | `CREATE OR REPLACE VIEW` |
| 関数 | `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE` |
| ポリシー | `DROP POLICY IF EXISTS` + `CREATE POLICY` |
| トリガー | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` |
| ENUM型 | `DO $$ ... EXCEPTION WHEN duplicate_object` |

---

## 🎯 作成されるデータベースオブジェクト

### テーブル (5個)
1. `report_bookmarks` - お気に入り
2. `report_likes` - いいね
3. `report_comments` - コメント
4. `report_shares` - シェア追跡
5. `report_notifications` - 通知

### ビュー (4個)
1. `report_stats` - 報告ごとの統計
2. `public_reports_with_stats` - 公開報告+統計
3. `danger_category_stats` - カテゴリー統計
4. `user_report_activity` - ユーザーアクティビティ

### Helper関数 (5個)
1. `toggle_report_bookmark(user_id, report_id)` → boolean
2. `toggle_report_like(user_id, report_id)` → boolean
3. `get_user_bookmarked_reports(user_id)` → SETOF json
4. `get_trending_reports(limit, days)` → SETOF json
5. `get_report_comments(report_id)` → SETOF json

### RLSポリシー (14個)
- ユーザーは自分のブックマーク/いいね/コメントのみ管理可能
- すべてのいいねとコメントは公開
- シェアは認証済みユーザーのみ作成可能
- 通知は本人のみ閲覧・更新可能

### トリガー (2個)
1. `update_report_comments_updated_at` - コメント更新時刻の自動更新
2. `set_report_comment_edited` - コメント編集フラグの自動設定

### インデックス (15個)
- 各テーブルに高速検索用のインデックスを設定
- user_id, report_id, created_at などの頻繁に使用されるカラム

---

## 🚀 実行方法

### 1. Supabase SQL Editorで実行

1. https://supabase.com/dashboard を開く
2. プロジェクトを選択
3. **SQL Editor** → **New query**
4. `database-migration-report-gallery-feed.sql` の内容をコピー&ペースト
5. **Run** ボタンをクリック ▶️

### 2. 成功の確認

実行成功時の表示：
```
Success. No rows returned
```

または

```
COMMIT
```

### 3. テーブル作成の確認

```sql
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

---

## 🧪 テスト

```bash
npm run test:db-migration
```

期待される結果：
```
✅ Tables Existence: PASSED
✅ Views Existence: PASSED
✅ Statistics: PASSED
✅ Helper Functions: PASSED
```

**注意**: Bookmark/Like/Comment/Shareのテストは認証済みユーザーでのみパスします（RLSポリシーが機能しているため）

---

## ⚠️ トラブルシューティング

### エラーが出た場合

#### "permission denied"
→ Supabaseダッシュボードの管理者権限で実行していることを確認

#### "relation does not exist"
→ `danger_reports` テーブルが存在することを確認
→ 先に他のマイグレーションファイルを実行する必要があるかもしれません

#### "already exists" エラー
→ SQLファイルには `IF EXISTS` チェックが含まれているので、再度実行すれば成功するはずです

---

## 📝 変更履歴

| 日時 | 問題 | 修正内容 |
|------|------|---------|
| 2025-10-28 | 構文エラー | `\$\$` → `$$` |
| 2025-10-28 | ポリシー重複 | `DROP POLICY IF EXISTS` 追加 |
| 2025-10-28 | 関数型変更 | `DROP FUNCTION IF EXISTS` 追加 |
| 2025-10-28 | トリガー重複 | `DROP TRIGGER IF EXISTS` 追加 |

---

## ✅ チェックリスト

実行前に確認：
- [ ] Supabaseダッシュボードにアクセスできる
- [ ] 管理者権限がある
- [ ] `danger_reports` テーブルが存在する
- [ ] バックアップが取得されている（推奨）

実行後に確認：
- [ ] エラーなく完了した
- [ ] 5つのテーブルが作成された
- [ ] 4つのビューが作成された
- [ ] 5つの関数が作成された
- [ ] テストが実行できる

---

## 📚 関連ドキュメント

- `QUICK_START_MIGRATION.md` - クイックスタートガイド
- `MIGRATION_INSTRUCTIONS.md` - 詳細な手順書
- `DATABASE_GALLERY_FEED_README.md` - API使用方法と例
- `lib/report-gallery-types.ts` - TypeScript型定義

---

## 🎉 完了！

すべての問題が修正され、マイグレーションは**安全に何度でも実行可能**です。

問題がある場合は、エラーメッセージ全文を確認してください。
