# なし

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/globalbunny77-gmailcoms-projects/v0--koujw6zjtpn)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/kOUJW6zJTPN)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/globalbunny77-gmailcoms-projects/v0--koujw6zjtpn](https://vercel.com/globalbunny77-gmailcoms-projects/v0--koujw6zjtpn)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/kOUJW6zJTPN](https://v0.dev/chat/projects/kOUJW6zJTPN)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

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