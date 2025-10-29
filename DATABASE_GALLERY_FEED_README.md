# 危険報告ギャラリー・共有フィード データベース設計

## 概要

このSQLマイグレーションは、危険報告のソーシャル機能（お気に入り、いいね、コメント、シェア）とギャラリー表示機能を提供します。

## 機能一覧

### 1. お気に入り機能 (Bookmarks)
- ユーザーが気になる危険報告を保存
- 後で簡単にアクセス可能

### 2. いいね機能 (Likes)
- 危険報告に「いいね」を付ける
- 報告の重要度を示す指標

### 3. コメント機能 (Comments)
- 危険報告に対してコメントを投稿
- 返信機能（ネストコメント）をサポート
- 編集履歴の追跡

### 4. シェア追跡 (Shares)
- Twitter、Facebook、LINEなどへのシェアを追跡
- 拡散状況の分析

### 5. 統計情報
- 報告ごとのエンゲージメント統計
- カテゴリー別の統計
- ユーザーアクティビティの追跡

## データベース構造

### テーブル

#### `report_bookmarks`
```sql
- id: uuid (PK)
- user_id: uuid (FK to auth.users)
- report_id: uuid (FK to danger_reports)
- created_at: timestamptz
- UNIQUE(user_id, report_id)
```

#### `report_likes`
```sql
- id: uuid (PK)
- user_id: uuid (FK to auth.users)
- report_id: uuid (FK to danger_reports)
- created_at: timestamptz
- UNIQUE(user_id, report_id)
```

#### `report_comments`
```sql
- id: uuid (PK)
- user_id: uuid (FK to auth.users)
- report_id: uuid (FK to danger_reports)
- content: text (1-1000文字)
- parent_comment_id: uuid (FK to report_comments, nullable)
- is_edited: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

#### `report_shares`
```sql
- id: uuid (PK)
- user_id: uuid (FK to auth.users, nullable)
- report_id: uuid (FK to danger_reports)
- platform: enum ('twitter', 'facebook', 'line', 'clipboard', 'other')
- created_at: timestamptz
```

#### `report_notifications`
```sql
- id: uuid (PK)
- user_id: uuid (FK to auth.users)
- report_id: uuid (FK to danger_reports)
- notification_type: text ('like', 'comment', 'share', 'bookmark')
- actor_user_id: uuid (FK to auth.users)
- is_read: boolean
- created_at: timestamptz
```

### ビュー

#### `report_stats`
各報告のエンゲージメント統計を集計
- likes_count
- bookmarks_count
- comments_count
- shares_count

#### `public_reports_with_stats`
承認済み報告と統計情報を結合したビュー

#### `danger_category_stats`
危険種別ごとの統計情報

#### `user_report_activity`
ユーザーのアクティビティサマリー

## Helper関数

### `toggle_report_bookmark(user_id, report_id)`
お気に入りのON/OFFを切り替え
```sql
SELECT toggle_report_bookmark('user-uuid', 'report-uuid');
-- Returns: true (追加) or false (削除)
```

### `toggle_report_like(user_id, report_id)`
いいねのON/OFFを切り替え
```sql
SELECT toggle_report_like('user-uuid', 'report-uuid');
-- Returns: true (追加) or false (削除)
```

### `get_user_bookmarked_reports(user_id)`
ユーザーのブックマーク一覧を取得
```sql
SELECT * FROM get_user_bookmarked_reports('user-uuid');
```

### `get_trending_reports(limit, days)`
トレンディングな報告を取得（エンゲージメントスコア順）
```sql
SELECT * FROM get_trending_reports(10, 7);
-- 直近7日間で最もエンゲージメントの高い報告を10件取得
```

### `get_report_comments(report_id)`
報告のコメント一覧を取得
```sql
SELECT * FROM get_report_comments('report-uuid');
```

## 使用例（TypeScript/Supabase）

### お気に入りの追加/削除

```typescript
// お気に入りを追加
const { data, error } = await supabase
  .from('report_bookmarks')
  .insert({ user_id: userId, report_id: reportId })

// お気に入りを削除
const { data, error } = await supabase
  .from('report_bookmarks')
  .delete()
  .match({ user_id: userId, report_id: reportId })

// または toggle 関数を使用
const { data, error } = await supabase
  .rpc('toggle_report_bookmark', {
    p_user_id: userId,
    p_report_id: reportId
  })
```

### いいねの追加/削除

```typescript
// いいねを追加
const { data, error } = await supabase
  .from('report_likes')
  .insert({ user_id: userId, report_id: reportId })

// または toggle 関数を使用
const { data, error } = await supabase
  .rpc('toggle_report_like', {
    p_user_id: userId,
    p_report_id: reportId
  })
```

### コメントの投稿

```typescript
// 新しいコメントを投稿
const { data, error } = await supabase
  .from('report_comments')
  .insert({
    user_id: userId,
    report_id: reportId,
    content: 'コメント内容',
    parent_comment_id: null // 返信の場合は親コメントIDを指定
  })

// コメントの編集
const { data, error } = await supabase
  .from('report_comments')
  .update({ content: '更新されたコメント' })
  .eq('id', commentId)
  .eq('user_id', userId)
```

### シェアの記録

```typescript
const { data, error } = await supabase
  .from('report_shares')
  .insert({
    user_id: userId,
    report_id: reportId,
    platform: 'twitter' // 'facebook', 'line', 'clipboard', 'other'
  })
```

### 統計情報付き報告の取得

```typescript
// 承認済み報告を統計情報付きで取得
const { data, error } = await supabase
  .from('public_reports_with_stats')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)

// トレンディング報告を取得
const { data, error } = await supabase
  .rpc('get_trending_reports', {
    p_limit: 10,
    p_days: 7
  })
```

### ユーザーのブックマーク取得

```typescript
const { data, error } = await supabase
  .rpc('get_user_bookmarked_reports', {
    p_user_id: userId
  })
```

### 報告のコメント取得

```typescript
const { data, error } = await supabase
  .rpc('get_report_comments', {
    p_report_id: reportId
  })
```

### カテゴリー統計の取得

```typescript
const { data, error } = await supabase
  .from('danger_category_stats')
  .select('*')
  .order('total_reports', { ascending: false })
```

### ユーザーアクティビティの取得

```typescript
const { data, error } = await supabase
  .from('user_report_activity')
  .select('*')
  .eq('user_id', userId)
  .single()
```

## Row Level Security (RLS) ポリシー

すべてのテーブルでRLSが有効化されています：

### Bookmarks
- ユーザーは自分のブックマークのみ表示・作成・削除可能

### Likes
- すべてのいいねは誰でも表示可能
- ユーザーは自分のいいねのみ作成・削除可能

### Comments
- すべてのコメントは誰でも表示可能
- ユーザーは自分のコメントのみ作成・更新・削除可能

### Shares
- シェア数は誰でも表示可能
- 認証済みユーザーのみシェアを作成可能

### Notifications
- ユーザーは自分の通知のみ表示・更新可能

## インストール

1. Supabaseダッシュボードにアクセス
2. SQL Editorを開く
3. `database-migration-report-gallery-feed.sql` の内容を貼り付け
4. 実行

または、Supabase CLIを使用：

```bash
supabase db push --file database-migration-report-gallery-feed.sql
```

## 注意事項

1. **既存データとの互換性**: このマイグレーションは既存の `danger_reports` テーブルに依存します
2. **パフォーマンス**: 大量のデータがある場合、インデックスが適切に機能していることを確認してください
3. **通知機能**: `report_notifications` テーブルは将来の実装用です。リアルタイム通知を実装する際に使用できます

## トラブルシューティング

### エラー: "relation does not exist"
- `danger_reports` テーブルが存在することを確認してください
- 既存のマイグレーションが正しく実行されているか確認してください

### RLSポリシーエラー
- ユーザーが正しく認証されているか確認してください
- `auth.uid()` が正しいユーザーIDを返すか確認してください

## 今後の拡張案

1. **リアルタイム通知**: Supabase Realtimeを使用した通知システム
2. **メンション機能**: コメント内でユーザーをメンション
3. **投票機能**: 複数の選択肢から投票
4. **報告フィード**: フォローしているユーザーの報告を表示
5. **検索機能**: コメントや報告の全文検索
