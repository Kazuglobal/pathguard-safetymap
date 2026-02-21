# PathGuardian - AI安全マップ アプリ概要

> AIとコミュニティの力で、安全な街づくりを支援するプラットフォーム。通学路・通勤路のリスクを可視化し、みんなで守る安心な環境を作ります。

## 目的

地域の危険箇所やリスクを地図上で可視化し、住民同士の情報共有を通じて安全な街づくりを支援する。特に子どもの通学路の安全確保に重点を置いたWebアプリケーション。

## 主な機能

| 機能 | ルート | 概要 |
|---|---|---|
| ランディングページ | `/landing` | サービス紹介・ヒーローカルーセル |
| 安全マップ | `/map` | Mapboxベースのインタラクティブ地図。危険箇所マーカー・事故ヒートマップ・ARビュー・3D表示を統合 |
| 危険箇所レポート | `/report` | ユーザーが危険箇所を写真付きで投稿・共有。いいね・ブックマーク・コメント機能付き |
| 通学路管理 | `/routes` | 通学ルートの登録・編集・お気に入り設定。距離/時間の表示。Mapbox経路探索連携 |
| ダッシュボード | `/dashboard` | レポート統計やチャートによるデータ分析（管理者向け） |
| ハザードゲーム | `/hazard-game` | 写真からAIが危険箇所を分析するゲーミフィケーション。GPT-4o Vision使用 |
| ルートクイズ | `/route-quiz` | 通学路に関する安全クイズ |
| ミッション | `/missions` | デイリー/ウィークリーの目標達成でポイント獲得 |
| バッジ | `/badges` | 貢献に応じたバッジ付与 |
| リーダーボード | `/leaderboard` | ユーザーランキング |
| SAFE MAGAZINE | `/safe-magazine` | 安全に関するコンテンツ・記事 |
| 通学路安全ニュース | `/school-route-news` | 通学路の安全に関するニュース更新 |
| 管理者画面 | `/admin` | レポート承認・ユーザー管理・API利用状況の管理 |
| xROAD連携 | `/xroad` | 国土交通省道路データプラットフォームとの連携 |
| 画像生成ツール | `/tools/image-gen` | Gemini APIによる画像生成 |

## 技術スタック

### フロントエンド

- **フレームワーク**: Next.js 16 (App Router) + React 19 + TypeScript
- **スタイリング**: Tailwind CSS 3.4 + PostCSS
- **UIライブラリ**: shadcn/ui (Radix UI)
- **アニメーション**: Framer Motion
- **チャート**: Recharts
- **地図**: Mapbox GL + react-map-gl + Turf.js（空間解析）
- **3D**: Three.js (React Three Fiber / Drei)
- **状態管理**: React Hooks + SWR
- **フォーム**: React Hook Form + Zod

### バックエンド / データベース

- **BaaS**: Supabase（PostgreSQL + Auth + Storage + Edge Functions）
- **認証**: Supabase Auth（JWT）
- **セキュリティ**: Row Level Security (RLS) ポリシー
- **API**: Next.js API Routes

### AI / 外部API

- **OpenAI GPT-4o Vision**: 写真からの危険箇所自動分析
- **Google Gemini**: 画像生成・プロンプト処理
- **Mapbox**: 地図表示・経路探索・ジオコーディング
- **xROAD**: 国土交通省の道路データ
- **交通事故データ**: 事故ヒートマップの表示

### テスト

- **ユニットテスト**: Vitest + React Testing Library
- **E2Eテスト**: Playwright（モバイル・タブレット・デスクトップ対応）

### デプロイ / インフラ

- **ホスティング**: Vercel
- **パッケージマネージャ**: pnpm 9.15
- **Node.js**: 20.x
- **開発ツール**: v0.dev

## プロジェクト構造

```
app/              Next.js App Router ページ群
app/api/          APIルート（mapbox, gemini, xroad, hazard-game等）
components/       Reactコンポーネント（約133ファイル）
  ├── ui/         shadcn/ui ベースコンポーネント
  ├── map/        地図関連（26ファイル）
  ├── landing/    ランディングページ
  ├── auth/       認証フォーム
  ├── dashboard/  ダッシュボード
  ├── hazard-game/ ゲームUI
  ├── report/     レポート表示
  ├── danger-report/ レポート作成・編集
  ├── badges/     バッジ表示
  ├── comments/   コメント
  └── admin/      管理者向け
hooks/            カスタムReactフック（19個）
lib/              ユーティリティ・APIクライアント・Supabaseクライアント
supabase/         DBマイグレーション・Edge Functions・設定
scripts/          環境検証・テスト・データ投入スクリプト
tests/            テストコード（unit, components, responsive, integration）
types/            TypeScript型定義
public/           静的ファイル
content/          コンテンツデータ（SAFE MAGAZINE記事等）
docs/             ドキュメント
```

## データベース主要テーブル

| テーブル | 用途 |
|---|---|
| `profiles` | ユーザープロフィール（アバター・自己紹介等） |
| `danger_reports` | 危険箇所レポート |
| `user_routes` | ユーザー定義の通学路（GeoJSON） |
| `hazard_game_sessions` | ハザードゲームのプレイ履歴 |
| `badges` / `user_badges` | バッジ定義・取得状況 |
| `user_points` | ポイント管理 |
| `missions` / `mission_progress` | ミッション定義・進捗 |
| `report_likes` / `report_bookmarks` | いいね・ブックマーク |
| `report_comments` | コメント |
| `report_notifications` | 通知 |

## ゲーミフィケーション

### ハザードゲームスコアリング

- 危険箇所検出ごとに **15pt**
- 高信頼度（80%以上）で **+5pt**
- 深刻度レベル4以上で **+10pt**
- 1画像あたり最大 **100pt**

### ランク

| ランク | スコア |
|---|---|
| 見習い | 0-59 |
| 安全推進者 | 60-69 |
| ハザード探偵 | 70-79 |
| 安全アナリスト | 80-89 |
| ハザードエキスパート | 90-94 |
| 安全マスター | 95-100 |

## 環境変数

```
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN     # Mapbox アクセストークン
NEXT_PUBLIC_SUPABASE_URL            # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY       # Supabase 匿名キー
OPENAI_API_KEY                      # OpenAI APIキー
NEXT_PUBLIC_XROAD_API_KEY           # xROAD APIキー
```

## クイックスタート

```bash
# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env.local

# 開発サーバー起動
pnpm dev

# テスト実行
pnpm test

# レスポンシブテスト
pnpm test:responsive

# ビルド
pnpm build
```

## 関連ドキュメント

- [HAZARD_GAME_README.md](./HAZARD_GAME_README.md) - ハザードゲーム機能
- [MAPBOX_INTEGRATION_GUIDE.md](./MAPBOX_INTEGRATION_GUIDE.md) - Mapbox連携ガイド
- [DATABASE_GALLERY_FEED_README.md](./DATABASE_GALLERY_FEED_README.md) - ソーシャル機能
- [TRAFFIC_ACCIDENT_INTEGRATION_GUIDE.md](./TRAFFIC_ACCIDENT_INTEGRATION_GUIDE.md) - 事故ヒートマップ
- [MIGRATION_INSTRUCTIONS.md](./MIGRATION_INSTRUCTIONS.md) - DBマイグレーション手順
- [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md) - デプロイガイド
- [RESPONSIVE_TESTING_README.md](./RESPONSIVE_TESTING_README.md) - E2Eテスト
- [MCP_SETUP_GUIDE.md](./MCP_SETUP_GUIDE.md) - MCPサーバー設定
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - クイックリファレンス
