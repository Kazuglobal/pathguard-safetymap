# SafeRoute 機能強化 Todoリスト

> **最終更新日**: 2026-01-29
> **プロジェクト**: SafeRoute (通学路安全マップ)
> **フレームワーク**: Next.js 15 + React 19 + Supabase

---

## 📊 進捗状況

| Phase | 完了 | 進行中 | 未着手 | 合計 |
|-------|------|--------|--------|------|
| Phase 1 | 11 | 0 | 8 | 19 |
| Phase 2 | 0 | 0 | 5 | 5 |
| Phase 3 | 1 | 0 | 1 | 2 |
| **合計** | **12** | **0** | **14** | **26** |

**全体進捗**: 46% (12/26)

---

## Phase 1: 既存機能の補完（優先度: 高）

### 1.1 バッジページの機能強化

**目標**: 現在の最小限のバッジページを、視覚的に魅力的で情報豊富なページに改善

#### タスク一覧

- [x] **1-1-badges-ui**: バッジページ: 全バッジ一覧とユーザー取得状況の表示UI作成 ✅
  - **ファイル**: `app/badges/page.tsx`
  - **詳細**:
    - 全バッジを `badges` テーブルから取得
    - ユーザー取得済みバッジを `user_badges` テーブルから取得
    - グリッドレイアウトで一覧表示
  - **依存**: なし
  - **工数**: 1h

- [x] **1-1-badges-card**: バッジページ: バッジカードコンポーネント（アイコン、取得条件、日時） ✅
  - **ファイル**: `components/badges/badge-card.tsx`
  - **詳細**:
    - バッジカードコンポーネント作成
    - アイコン表示（`badges.icon`）
    - 取得/未取得の視覚的区別（グレーアウト）
    - 取得条件（`threshold`）表示
    - 取得日時（`acquired_at`）表示
  - **依存**: 1-1-badges-ui
  - **工数**: 1h

- [x] **1-1-badges-progress**: バッジページ: 進捗表示（現在ポイント/次のバッジまで） ✅
  - **ファイル**: `app/badges/page.tsx`
  - **詳細**:
    - 現在のポイント取得（`user_points` テーブル）
    - 次のバッジまでの必要ポイント計算
    - 進捗バー表示（`components/ui/progress.tsx` 使用）
  - **依存**: 1-1-badges-ui
  - **工数**: 0.5h

**合計工数**: 2.5h

---

### 1.2 プロフィール編集機能

**目標**: ユーザーがプロフィール情報（表示名、アバター）を編集できる機能を追加

#### タスク一覧

- [ ] **1-2-profile-form**: プロフィール編集: 編集フォームコンポーネント作成
  - **ファイル**: `components/profile/profile-edit-form.tsx` (新規)
  - **詳細**:
    - 表示名（`display_name`）入力フィールド
    - フルネーム（`full_name`）入力フィールド
    - バリデーション実装（Zod使用推奨）
    - 保存処理（Supabase更新）
  - **依存**: なし
  - **工数**: 1h

- [ ] **1-2-profile-avatar**: プロフィール編集: アバター画像アップロード機能
  - **ファイル**: `components/profile/profile-edit-form.tsx`
  - **詳細**:
    - 画像アップロードUI（ドラッグ&ドロップ対応）
    - Supabase Storageへのアップロード（`avatars` バケット）
    - `profiles.avatar_url` の更新
    - プレビュー表示
    - 画像リサイズ処理（クライアント側）
  - **依存**: 1-2-profile-form
  - **工数**: 1.5h

- [ ] **1-2-profile-integration**: プロフィール編集: マイページへの統合
  - **ファイル**: `app/mypage/page.tsx`
  - **詳細**:
    - マイページに編集セクション追加
    - または `/settings` ページ作成
    - 編集モーダル/シート実装
  - **依存**: 1-2-profile-form, 1-2-profile-avatar
  - **工数**: 0.5h

**合計工数**: 3h

**注意**: `profiles` テーブルに `avatar_url` カラムがない場合は、マイグレーションが必要

---

### 1.3 パスワードリセット機能

**目標**: パスワードを忘れたユーザーがリセットできる機能を実装

#### タスク一覧

- [x] **1-3-forgot-page**: パスワードリセット: forgot-password ページ作成 ✅
  - **ファイル**: `app/forgot-password/page.tsx` (新規)
  - **詳細**:
    - `/app/forgot-password/page.tsx` 作成
    - メールアドレス入力フォーム
    - `supabase.auth.resetPasswordForEmail()` 呼び出し
    - 送信完了メッセージ表示
    - エラーハンドリング
  - **依存**: なし
  - **工数**: 1h

- [x] **1-3-reset-page**: パスワードリセット: reset-password ページ作成 ✅
  - **ファイル**: `app/reset-password/page.tsx` (新規)
  - **詳細**:
    - `/app/reset-password/page.tsx` 作成
    - 新しいパスワード入力フォーム（確認用も）
    - `supabase.auth.updateUser()` 呼び出し
    - リダイレクト処理（ログインページへ）
    - トークン検証
  - **依存**: 1-3-forgot-page
  - **工数**: 1h

- [x] **1-3-login-link**: パスワードリセット: ログインページにリンク追加 ✅
  - **ファイル**: `components/auth/login-form.tsx`
  - **詳細**:
    - `components/auth/login-form.tsx` に「パスワードを忘れた」リンク追加
    - `/forgot-password` へのリンク
    - スタイリング調整
  - **依存**: 1-3-forgot-page
  - **工数**: 0.5h

**合計工数**: 2.5h

---

### 1.4 通知機能のUI実装

**目標**: データベースに存在する通知機能をUIで利用可能にする

#### タスク一覧

- [x] **1-4-notification-hook**: 通知機能: use-notifications フック作成 ✅
  - **ファイル**: `hooks/use-notifications.ts` (新規)
  - **詳細**:
    - `hooks/use-notifications.ts` 作成
    - SWRを使用した通知データ取得
    - 未読数カウント
    - 既読化処理（`is_read` 更新）
    - リアルタイム更新（Supabase Realtime オプション）
  - **依存**: なし
  - **工数**: 1h

- [x] **1-4-notification-bell**: 通知機能: NotificationBell コンポーネント作成 ✅
  - **ファイル**: `components/notifications/notification-bell.tsx` (新規)
  - **詳細**:
    - `components/notifications/notification-bell.tsx` 作成
    - ベルアイコン表示（`lucide-react` の `Bell` 使用）
    - 未読数バッジ表示（`Badge` コンポーネント使用）
    - クリックでドロップダウン/シート表示
    - アニメーション（未読がある場合）
  - **依存**: 1-4-notification-hook
  - **工数**: 1.5h

- [x] **1-4-notification-list**: 通知機能: 通知一覧コンポーネント作成 ✅
  - **ファイル**: `components/notifications/notification-list.tsx` (新規)
  - **詳細**:
    - `components/notifications/notification-list.tsx` 作成
    - 通知アイテム表示（タイトル、内容、日時）
    - 既読/未読状態表示（視覚的区別）
    - クリックで既読化 + リンク遷移（`link` フィールド使用）
    - 空状態表示
  - **依存**: 1-4-notification-hook
  - **工数**: 1h

- [x] **1-4-notification-nav**: 通知機能: ナビゲーションへの統合 ✅
  - **ファイル**: `components/ui/navigation.tsx`
  - **詳細**:
    - `components/ui/navigation.tsx` に NotificationBell 追加
    - ヘッダー右側に配置（ユーザー情報の隣）
    - レスポンシブ対応（モバイル表示も考慮）
  - **依存**: 1-4-notification-bell, 1-4-notification-list
  - **工数**: 0.5h

**合計工数**: 4h

---

### 1.5 いいね/保存機能の永続化

**目標**: 現在ローカルstateのみのいいね/保存機能をデータベースに永続化

#### タスク一覧

- [ ] **1-5-likes-migration**: いいね/保存: report_likes テーブルのマイグレーション
  - **ファイル**: `database-migrations/add-report-likes.sql` (新規)
  - **詳細**:
    - `database-migrations/add-report-likes.sql` 作成
    - `report_likes` テーブル作成
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key → profiles.id)
      - `report_id` (uuid, foreign key → danger_reports.id)
      - `created_at` (timestamp)
    - RLSポリシー設定（ユーザーは自分のいいねのみ閲覧/削除可能）
    - インデックス追加（`user_id`, `report_id`）
    - ユニーク制約（`user_id`, `report_id`）
  - **依存**: なし
  - **工数**: 0.5h

- [ ] **1-5-saves-migration**: いいね/保存: report_saves テーブルのマイグレーション
  - **ファイル**: `database-migrations/add-report-saves.sql` (新規)
  - **詳細**:
    - `database-migrations/add-report-saves.sql` 作成
    - `report_saves` テーブル作成
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key → profiles.id)
      - `report_id` (uuid, foreign key → danger_reports.id)
      - `created_at` (timestamp)
    - RLSポリシー設定（ユーザーは自分の保存のみ閲覧/削除可能）
    - インデックス追加（`user_id`, `report_id`）
    - ユニーク制約（`user_id`, `report_id`）
  - **依存**: なし
  - **工数**: 0.5h

- [ ] **1-5-interactions-hook**: いいね/保存: use-report-interactions フック作成
  - **ファイル**: `hooks/use-report-interactions.ts` (新規)
  - **詳細**:
    - `hooks/use-report-interactions.ts` 作成
    - `useLike(reportId)` - いいね状態管理
      - いいね状態取得
      - いいね追加/削除
      - いいね数取得
    - `useSave(reportId)` - 保存状態管理
      - 保存状態取得
      - 保存追加/削除
    - 楽観的UI更新（即座にUI反映、その後DB同期）
    - エラーハンドリング
  - **依存**: 1-5-likes-migration, 1-5-saves-migration
  - **工数**: 2h

- [ ] **1-5-report-integration**: いいね/保存: report ページへの統合
  - **ファイル**: `app/report/page.tsx`
  - **詳細**:
    - `app/report/page.tsx` のローカルstateをフック使用に変更
    - `ShareActionState` をデータベースから取得
    - データベースとの同期
    - ローディング状態表示
  - **依存**: 1-5-interactions-hook
  - **工数**: 1h

**合計工数**: 4h

**注意**: マイグレーション実行後、`lib/database.types.ts` を更新する必要があります

---

### 1.6 コメント機能のUI実装

**目標**: 危険報告へのコメント機能をUIで実装

#### タスク一覧

- [x] **1-6-comment-components**: コメント機能: コメントセクション/アイテムコンポーネント作成 ✅
  - **ファイル**:
    - `components/comments/comment-section.tsx` (新規)
    - `components/comments/comment-item.tsx` (新規)
  - **詳細**:
    - `components/comments/comment-section.tsx` 作成
      - コメント一覧表示
      - 新規コメント投稿フォーム
      - バリデーション
    - `components/comments/comment-item.tsx` 作成
      - 個別コメント表示
      - 公式コメントバッジ表示（`is_official` が true の場合）
      - 日時表示
      - ユーザー情報表示（オプション）
  - **依存**: なし
  - **工数**: 2h

- [ ] **1-6-comment-integration**: コメント機能: 報告詳細への統合
  - **ファイル**:
    - `components/dashboard/report-detail-modal.tsx`
    - または `app/report/[id]/page.tsx` (新規)
  - **詳細**:
    - 報告詳細モーダルにコメントセクション追加
    - または `/report/[id]` ページ作成
    - コメント投稿機能
    - コメント一覧表示
  - **依存**: 1-6-comment-components
  - **工数**: 1h

**合計工数**: 3h

**注意**: `comments` テーブルは `danger_spots` に紐づいていますが、`danger_reports` 用のコメントテーブルが必要な場合は追加マイグレーションが必要です

---

## Phase 2: 追加機能（優先度: 中）

### 2.1 通学路管理機能

**目標**: ユーザーが通学ルートを保存し、ルート上の危険箇所を管理できる機能

#### タスク一覧

- [ ] **2-1-routes-migration**: 通学路管理: user_routes テーブルのマイグレーション
  - **ファイル**: `database-migrations/add-user-routes.sql` (新規)
  - **詳細**:
    - `database-migrations/add-user-routes.sql` 作成
    - `user_routes` テーブル作成
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key → profiles.id)
      - `name` (text) - ルート名
      - `start_point` (geography(Point)) - スタート地点
      - `end_point` (geography(Point)) - ゴール地点
      - `route_geometry` (geography(LineString)) - ルート形状
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - RLSポリシー設定
    - インデックス追加（`user_id`, `route_geometry`）
  - **依存**: なし
  - **工数**: 1h

- [ ] **2-1-routes-page**: 通学路管理: routes ページ作成
  - **ファイル**: `app/routes/page.tsx` (新規)
  - **詳細**:
    - `app/routes/page.tsx` 作成
    - 保存済みルート一覧表示
    - ルート追加フォーム
    - ルート削除機能
    - ルート編集機能
  - **依存**: 2-1-routes-migration
  - **工数**: 2h

- [ ] **2-1-route-manager**: 通学路管理: ルート管理コンポーネント作成
  - **ファイル**: `components/map/route-manager.tsx` (新規)
  - **詳細**:
    - `components/map/route-manager.tsx` 作成
    - ルート登録UI（マップ上でスタート/ゴール選択）
    - ルート上の危険箇所表示
    - 危険箇所アラート機能
  - **依存**: 2-1-routes-migration
  - **工数**: 3h

**合計工数**: 6h

---

### 2.2 検索・フィルタリング強化

**目標**: 危険報告の検索・フィルタリング機能を強化

#### タスク一覧

- [ ] **2-2-map-filters**: 検索・フィルタリング: マップフィルターコンポーネント作成
  - **ファイル**: `components/map/map-filters.tsx` (新規)
  - **詳細**:
    - `components/map/map-filters.tsx` 作成
    - 危険タイプフィルター（traffic/crime/disaster/other）
    - 危険度フィルター（1-5）
    - 日付範囲フィルター（`react-day-picker` 使用）
    - ステータスフィルター（pending/approved/resolved）
  - **依存**: なし
  - **工数**: 2h

- [ ] **2-2-report-filters**: 検索・フィルタリング: 報告ページフィルター追加
  - **ファイル**: `app/report/page.tsx`
  - **詳細**:
    - `app/report/page.tsx` にフィルタリングUI追加
    - フィルター状態管理
    - フィルター適用処理
  - **依存**: 2-2-map-filters
  - **工数**: 1h

**合計工数**: 3h

---

## Phase 3: 技術改善

### 3.1 デバッグコードの削除

- [ ] **3-1-debug-cleanup**: デバッグコード削除: map/page.tsx のfetch削除
  - **ファイル**: `app/map/page.tsx`
  - **詳細**:
    - `app/map/page.tsx` の開発用fetch呼び出しを削除
    - コード整理
    - 不要なコメント削除
  - **依存**: なし
  - **工数**: 0.5h

---

### 3.2 エラーハンドリングの統一

- [x] **3-2-error-handling**: エラーハンドリング: 共通ユーティリティ作成 ✅
  - **ファイル**: `lib/error-handler.ts` (新規)
  - **詳細**:
    - `lib/error-handler.ts` 作成
    - 統一されたエラーハンドリング関数
    - エラーメッセージの標準化
    - ログ出力機能
    - 各コンポーネントでの使用
  - **依存**: なし
  - **工数**: 1h

---

## 📝 実装時の注意事項

### データベース関連

1. **マイグレーション実行**
   - Supabase ダッシュボードで実行
   - または `supabase migration` コマンドで実行
   - 実行後、`lib/database.types.ts` を更新

2. **RLSポリシー**
   - すべての新規テーブルに適切なRLSポリシーを設定
   - ユーザーは自分のデータのみアクセス可能にする

3. **型定義**
   - マイグレーション後、`npm run typecheck` で型エラーを確認
   - `lib/database.types.ts` を手動更新するか、Supabase CLIで自動生成

### コンポーネント作成

1. **既存パターンに従う**
   - `components/ui` のコンポーネントを使用
   - 既存のスタイリングパターンに従う

2. **レスポンシブ対応**
   - モバイルファーストで実装
   - Tailwind CSS の既存クラスを使用

3. **アクセシビリティ**
   - 適切な `aria-label` を設定
   - キーボードナビゲーション対応

### 状態管理

1. **SWR使用**
   - データフェッチには既存のSWRパターンに従う
   - `hooks/use-gamification.ts` を参考にする

2. **楽観的UI更新**
   - ユーザー体験向上のため、即座にUI更新してからDB同期

---

## 🔗 関連ファイル

### 既存ファイル（参考）

- `lib/gamification.ts` - ゲーミフィケーション関数
- `hooks/use-gamification.ts` - ゲーミフィケーションフック
- `hooks/use-missions.ts` - ミッションフック
- `components/ui/navigation.tsx` - ナビゲーションコンポーネント
- `app/report/page.tsx` - 報告ページ（いいね/保存機能の統合先）

### 新規作成ファイル

- `components/badges/badge-card.tsx`
- `components/profile/profile-edit-form.tsx`
- `components/notifications/notification-bell.tsx`
- `components/notifications/notification-list.tsx`
- `components/comments/comment-section.tsx`
- `components/comments/comment-item.tsx`
- `hooks/use-notifications.ts`
- `hooks/use-report-interactions.ts`
- `database-migrations/add-report-likes.sql`
- `database-migrations/add-report-saves.sql`
- `database-migrations/add-user-routes.sql`

---

## 📅 実装スケジュール（推奨）

| 週 | Phase | タスク | 工数 |
|---|-------|--------|------|
| 1週目 | Phase 1.1-1.3 | バッジ、プロフィール、パスワードリセット | 8h |
| 2週目 | Phase 1.4-1.5 | 通知、いいね/保存 | 8h |
| 3週目 | Phase 1.6, 3.1-3.2 | コメント、技術改善 | 4.5h |
| 4週目 | Phase 2 | 追加機能 | 9h |

**合計**: 約29.5時間

---

## ✅ チェックリスト形式（コピー用）

```
Phase 1.1: バッジページ
[x] 1-1-badges-ui
[x] 1-1-badges-card
[x] 1-1-badges-progress

Phase 1.2: プロフィール編集
[ ] 1-2-profile-form
[ ] 1-2-profile-avatar
[ ] 1-2-profile-integration

Phase 1.3: パスワードリセット
[x] 1-3-forgot-page
[x] 1-3-reset-page
[x] 1-3-login-link

Phase 1.4: 通知機能
[x] 1-4-notification-hook
[x] 1-4-notification-bell
[x] 1-4-notification-list
[x] 1-4-notification-nav

Phase 1.5: いいね/保存
[ ] 1-5-likes-migration
[ ] 1-5-saves-migration
[ ] 1-5-interactions-hook
[ ] 1-5-report-integration

Phase 1.6: コメント機能
[x] 1-6-comment-components
[ ] 1-6-comment-integration

Phase 2.1: 通学路管理
[ ] 2-1-routes-migration
[ ] 2-1-routes-page
[ ] 2-1-route-manager

Phase 2.2: フィルタリング
[ ] 2-2-map-filters
[ ] 2-2-report-filters

Phase 3: 技術改善
[ ] 3-1-debug-cleanup
[x] 3-2-error-handling
```
