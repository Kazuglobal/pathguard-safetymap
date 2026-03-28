# 通学路の安全ニュース Daily Update Skill

## Description
通学路の安全ニュース（リアルタイムニュース）の日次更新を自動化するスキル。
全国の通学路関連ニュースを取得、検証、記事化、公開します。

## Trigger
- User says: "ニュース更新", "通学路ニュース取得", "/school-route-news-update"
- Daily scheduled update (7:00 AM JST)

## Difference from SAFE MAGAZINE

| 項目 | 通学路の安全ニュース | SAFE MAGAZINE |
|------|---------------------|---------------|
| 更新頻度 | リアルタイム/日次 | 週次/月次 |
| コンテンツ | 速報・事故・事件 | 教育・解説記事 |
| ソース | ニュースサイト | 公式資料・研究 |
| トーン | 速報・客観的 | 教育的・解説的 |

## Workflow

### Step 1: ニュース取得
WebSearch でキーワード検索:
```
- "通学路 事故 速報 2026"
- "通学路 不審者 2026"
- "スクールゾーン 事故"
- "登下校 児童"
```

### Step 2: ファクトチェック
- ソースの信頼性評価（公式発表優先）
- 複数ソースでクロスチェック
- 誤報・デマの除外

### Step 3: 記事作成
```typescript
// lib/school-route-news.ts に追加
{
  id: "news-YYYY-MM-DD-NNN",
  slug: "prefecture-type-YYYYMMDD",
  title: "【都道府県名】タイトル",
  excerpt: "150文字以内",
  content: "Markdown本文",
  category: "accident|suspicious|infrastructure|policy|community",
  location: { prefecture, city, area },
  publishedDate: "ISO8601",
  isBreaking: true/false
}
```

### Step 4: 画像生成
Gemini API でサムネイル生成:
- 事故: 警告色、抽象的表現
- 不審者: 注意喚起アイコン
- インフラ: 安全設備イメージ
- 地域活動: コミュニティ感

### Step 5: キャッシュクリア
```bash
rm -rf .next/cache
```

## カテゴリー

| ID | 名前 | 色 | アイコン |
|----|------|-----|---------|
| accident | 交通事故 | #EF4444 | AlertTriangle |
| suspicious | 不審者情報 | #F97316 | AlertCircle |
| infrastructure | インフラ整備 | #3B82F6 | Construction |
| policy | 施策・対策 | #8B5CF6 | FileText |
| community | 地域活動 | #22C55E | Users |

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `.claude/teams/school-route-news-team.json` | チーム設定 |
| `lib/school-route-news.ts` | データ定義 |
| `components/landing/SchoolRouteNewsSection.tsx` | 表示コンポーネント |
| `app/school-route-news/` | ニュース一覧・詳細ページ |

## 検索キーワード

### 交通事故
- "通学路 事故 速報"
- "スクールゾーン 交通事故"
- "登下校 児童 事故"
- "横断歩道 小学生"

### 不審者情報
- "通学路 不審者"
- "児童 声かけ事案"
- "登下校 つきまとい"
- "子ども 不審者 情報"

### インフラ整備
- "通学路 ガードレール 設置"
- "スクールゾーン 整備"
- "歩道 拡幅"
- "信号機 新設"

### 施策・対策
- "通学路 安全対策 自治体"
- "スクールゾーン 規制"
- "見守り活動 強化"

## データ保持期間
- 最新90日分のニュースを保持
- 90日以上前のニュースは自動削除

## エラーハンドリング
- API エラー: リトライ後、手動確認を促す
- ファクトチェック失敗: 記事化しない
- 重複ニュース: スキップ

---

## Layer 2: 地域アラート（リアルタイム）

### 概要

| 項目 | Layer 1（全国ニュース） | Layer 2（地域アラート） |
|------|----------------------|----------------------|
| 更新頻度 | 日次 07:00 | 2時間毎 |
| コンテンツ | 全国・編集部選定記事 | 都道府県・市区町村レベルの速報 |
| ストレージ | `lib/school-route-news.ts` 静的配列 | Supabase `local_safety_alerts` テーブル |
| エージェント | news-fetcher〜image-generator（5人） | local-alert-fetcher（1人） |

### トリガー
- Vercel Cron: `/api/cron/local-safety-alerts`（`0 */2 * * *`）
- エージェント: `local-alert-fetcher`

### Step A: データ取得
WebSearch キーワード:
```
- "声かけ事案 [都道府県名]"
- "不審者情報 [都道府県名] 警察"
- "つきまとい 通学路 [市区町村名]"
- "児童 安全 [都道府県名] 速報"
```

データソース:
- 各都道府県警察公式サイト `/防犯情報/声かけ事案`
- 市区町村の安全・安心メール公開アーカイブ
- 文部科学省 学校安全ポータルサイト

### Step B: Supabase INSERT
```sql
INSERT INTO local_safety_alerts
  (prefecture, city, category, description, source_url, occurred_at)
VALUES
  ('東京都', '世田谷区', 'voice_call', '説明文', 'https://...', '2026-03-28T09:00:00+09:00')
ON CONFLICT (prefecture, city, occurred_at) DO NOTHING;
```

カテゴリ分類:
- `suspicious`: 不審者（徘徊・写真撮影・その場に居座るなど）
- `voice_call`: 声かけ事案（話しかけ・誘い込みなど）
- `following`: つきまとい
- `other`: その他

### Step C: Push通知
Cron が `push_notified_at IS NULL` かつ `suspicious` / `voice_call` を自動通知。
エージェントからの手動通知は不要。

### 関連ファイル

| ファイル | 説明 |
|---------|------|
| `supabase/migrations/20260329000001_add_local_safety_alerts.sql` | テーブル定義 |
| `lib/push-notifications/notify-local-alert.ts` | Push通知ロジック |
| `app/api/cron/local-safety-alerts/route.ts` | Cronエンドポイント |
| `hooks/use-local-safety-alerts.ts` | フロントエンドHook |
| `components/landing/LocalSafetyAlertsSection.tsx` | UIコンポーネント |
