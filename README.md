# PathGuardian

通学路の危険箇所共有、ルート学習、防災ハザード判定を行う Next.js アプリです。本番基盤は Cloudflare Workers（OpenNext）+ D1 + R2、認証のみ Supabase Auth を利用します。

## Overview

データ移行と本番切替は [Cloudflare 本番切替 Runbook](./docs/runbooks/cloudflare-production-cutover.md) を参照してください。

### 🛣️ 通学路管理（Routes）

通学路の登録・編集・削除・お気に入り設定ができます。

- 画面: `/routes`（未ログイン時は `/login` へリダイレクト）
- 作成: 「ルート追加」→ ルート名入力 → 地図クリック or 座標入力でポイント追加 → 保存
- 表示: ルート一覧、距離/時間、選択状態、マップ上のポイント/線
- 必要な環境変数: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

### 🗺️ Mapbox Integration

This project includes comprehensive Mapbox integration with:
- **Client-side mapping** with MapboxGL
- **MCP (Model Context Protocol) server** for Claude integration
- **Advanced error handling** and monitoring
- **Rate limiting** and token validation

#### Quick Start
```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Test Mapbox integration
npm run test-mapbox

# Test MCP server setup
npm run test-mcp

# Start development server
npm run dev
```

#### Documentation
- 📖 [MAPBOX_INTEGRATION_GUIDE.md](./MAPBOX_INTEGRATION_GUIDE.md) - Complete Mapbox integration guide
- 🤖 [MCP_SETUP_GUIDE.md](./MCP_SETUP_GUIDE.md) - MCP server setup instructions

## Deployment

```bash
pnpm check:supabase-auth-only
pnpm typecheck
pnpm build:cloudflare
pnpm deploy:cloudflare
```

### 不審者アラートの本番反映メモ

- サーバ審査 API `/api/suspicious-alert/moderate` は Supabase Auth の設定と D1 バインディングが必要です。
- DB スキーマ更新は `pnpm db:migrate:remote` で D1 に適用します。`supabase/migrations/` は移行元の履歴資料であり、本番ランタイムには適用しません。

## xROAD API連携について

### 設定方法

1. [xROAD（道路データプラットフォーム）](https://www.xroad.mlit.go.jp/)にアクセスし、APIキーを取得してください。

2. `.env.local`ファイルに以下の設定を追加してください：
   ```
   # xROAD API設定
   NEXT_PUBLIC_XROAD_API_KEY=取得したAPIキー
   ```

3. 実装した機能を利用するには、以下のコンポーネントを使用します：
   ```tsx
   // 例：ページコンポーネント内での使用方法
   import XRoadMapExample from '@/components/map/xroad-map-example';
   
   export default function XRoadPage() {
     return (
       <div>
         <h1>道路データプラットフォーム連携マップ</h1>
         <XRoadMapExample />
       </div>
     );
   }
   ```

### 注意事項

- 実際のAPIエンドポイントやパラメータは、xROADの公式APIドキュメントに従って調整してください。
- APIの利用にはxROADの利用規約に従ってください。
- 高頻度のAPIリクエストは制限される可能性があります。

### カスタマイズ

データの表示形式や視覚化方法を変更するには、以下のファイルを編集してください：

- `lib/api/xroad.ts` - APIクライアント
- `hooks/use-xroad-data.ts` - データ取得フック
- `components/map/xroad-layer.tsx` - マップレイヤー
- `components/map/xroad-map-example.tsx` - 使用例
