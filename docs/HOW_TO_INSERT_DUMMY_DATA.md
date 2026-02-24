# ダミーデータの挿入方法

## 🚀 最速の方法（推奨）

### ステップ1: Supabase SQL Editorを開く

1. https://supabase.com/dashboard を開く
2. プロジェクトを選択
3. 左メニューから **SQL Editor** をクリック
4. **New query** をクリック

### ステップ2: SQLを実行

1. `insert-dummy-data-easy.sql` ファイルを開く
2. **すべての内容をコピー** (Ctrl+A → Ctrl+C)
3. Supabase SQL Editor に **貼り付け** (Ctrl+V)
4. **Run** ボタンをクリック ▶️

### ステップ3: 結果を確認

実行が成功すると、以下のような出力が表示されます：

```
✓ Found 3 unique users
✓ Found 10 approved reports

═══ Inserting Bookmarks ═══
✓ Inserted bookmarks

═══ Inserting Likes ═══
✓ Inserted likes

═══ Inserting Comments ═══
✓ Inserted comments

═══ Inserting Reply Comments ═══
✓ Inserted reply comments

═══ Inserting Shares ═══
✓ Inserted shares

═══ Summary ═══
✓ Total items inserted: 100+

📊 Current database totals:
  Bookmarks: 15
  Likes: 37
  Comments: 22
  Shares: 12
```

そして、エンゲージメントが最も高い報告のリストが表示されます。

---

## 📊 挿入されるデータ

### 各報告に対して：

| データ種類 | 数量 | 詳細 |
|-----------|------|------|
| いいね | 1-5個 | ランダムなユーザーから |
| ブックマーク | 0-2個 | ランダムなユーザーから |
| コメント | 1-4個 | 日本語のサンプルコメント |
| 返信コメント | 0-1個 | 既存のコメントへの返信 |
| シェア | 0-3個 | Twitter, Facebook, LINE, Clipboard |

### サンプルコメント例：

- 「この場所は本当に危険ですね。通学路として使っている子供たちが心配です。」
- 「昨日ここを通りましたが、確かに危ないと感じました。早く改善してほしいです。」
- 「詳細な報告ありがとうございます！参考になります。」
- 「私も同じ場所で危険を感じていました。」
- 「地域で対策を考える必要がありますね。」
- ...など10種類

---

## ✅ 実行後の確認

### コマンドラインからテスト

```bash
npm run test:gallery-api
```

期待される結果：
```
✓ Public Reports with Stats: PASSED
✓ Trending Reports: PASSED
✓ Category Stats: PASSED
✓ Report Comments: PASSED
✓ Engagement Counts: PASSED
```

### Supabaseダッシュボードで確認

1. **Table Editor** を開く
2. 以下のテーブルを確認：
   - `report_bookmarks` - データが入っているはず
   - `report_likes` - データが入っているはず
   - `report_comments` - データが入っているはず
   - `report_shares` - データが入っているはず

3. **SQL Editor** で統計を確認：
   ```sql
   SELECT * FROM report_stats ORDER BY likes_count DESC LIMIT 5;
   SELECT * FROM danger_category_stats;
   ```

---

## 🔄 データを再挿入したい場合

同じスクリプトを何度実行しても大丈夫です：
- ブックマークといいねは `ON CONFLICT DO NOTHING` で重複を防止
- コメントとシェアは毎回新しく追加されます

既存のデータをクリアしたい場合：

```sql
BEGIN;

DELETE FROM public.report_shares;
DELETE FROM public.report_comments;
DELETE FROM public.report_likes;
DELETE FROM public.report_bookmarks;

COMMIT;
```

その後、`insert-dummy-data-easy.sql` を再実行してください。

---

## 🎯 アプリケーションで確認

### 1. レポートページ

```bash
npm run dev
```

ブラウザで http://localhost:3000/report にアクセス

確認すること：
- ✅ 各報告にいいね数が表示される
- ✅ コメント数が表示される
- ✅ カテゴリー別の統計が表示される

### 2. マップページ

http://localhost:3000/map にアクセス

確認すること：
- ✅ マーカーをクリックすると詳細が表示される
- ✅ いいねボタンが機能する
- ✅ コメントが表示される

---

## ❌ トラブルシューティング

### エラー: "No users found"

**原因**: `danger_reports` テーブルにデータがない

**解決方法**:
1. マップページ (http://localhost:3000/map) から危険報告を作成
2. または、既存の報告を承認済みに変更：
   ```sql
   UPDATE public.danger_reports
   SET status = 'approved'
   WHERE status = 'pending';
   ```

### エラー: "No approved reports found"

**原因**: 承認済みの報告がない

**解決方法**:
```sql
UPDATE public.danger_reports
SET status = 'approved'
LIMIT 10;
```

### エラー: "permission denied"

**原因**: Supabase SQL Editor以外から実行している

**解決方法**:
必ずSupabase SQL Editorから実行してください。管理者権限が必要です。

---

## 📝 その他のオプション

### オプション1: Service Role Keyを使う（上級者向け）

`.env.local` に以下を追加：
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

その後：
```bash
npm run insert-dummy-data
```

**注意**: Service Role Keyは非常に強力な権限を持つため、本番環境では絶対に公開しないでください。

### オプション2: 手動でテストデータを作成

アプリケーションから手動でテスト：
1. ログイン
2. 報告を表示
3. いいねボタンをクリック
4. コメントを投稿
5. お気に入りに追加

---

## 🎉 完了！

ダミーデータが正常に挿入されたら：

```bash
npm run test:gallery-api
```

で動作確認してください。

すべてのテストがパスすれば成功です！ ✨
