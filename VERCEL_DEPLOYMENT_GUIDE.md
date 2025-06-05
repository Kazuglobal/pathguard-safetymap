# Vercelデプロイメントガイド

## 1. 依存関係の修正 ✅ 完了

### ✅ 実行済み
- `date-fns`を`v4.1.0`から`v3.6.0`にダウングレード済み
- `pnpm install`で依存関係をインストール済み
- TypeScriptエラーなし
- Next.jsビルドも正常完了

## 2. Vercelデプロイ設定

### Project Settings（プロジェクト作成時）
- **Framework Preset:** Next.js（自動検出）
- **Root Directory:** ./（そのまま）

### Build & Output Settings
```bash
# Install Command
npm install --legacy-peer-deps

# Build Command
npm run build

# Output Directory
.next

# Install Command Override: ON（重要）
```

## 3. 環境変数設定

### 必須の環境変数（Vercelで設定）
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 自動設定済み（next.config.mjsにハードコード）
以下の環境変数は`next.config.mjs`にハードコードされているため、Vercelで別途設定する必要はありません：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

## 4. デプロイ手順

1. **Vercelプロジェクトの作成**
   - GitHubリポジトリを接続
   - プロジェクト名を設定
   - Framework Preset: Next.js（自動検出）

2. **ビルド設定**
   - Settings → General → Build & Output Settings
   - Install Command Override: `npm install --legacy-peer-deps`
   - Build Command: `npm run build`（デフォルト）
   - Output Directory: `.next`（デフォルト）

3. **環境変数の設定**
   - Settings → Environment Variables
   - `SUPABASE_SERVICE_ROLE_KEY`を追加

4. **デプロイ実行**
   - Deploy ボタンをクリック

## 5. 重要な注意事項

### ❌ vercel.jsonは不要
- Next.jsプロジェクトでは`vercel.json`は通常不要
- Vercelが自動的にNext.jsを検出・設定
- `vercel.json`を作成すると「Function Runtimes must have a valid version」エラーの原因となる

### ✅ 依存関係の問題対策
- Install Command Overrideを必ず`npm install --legacy-peer-deps`に設定
- これによりピア依存関係の競合を回避

## 6. トラブルシューティング

### 「Function Runtimes must have a valid version」エラー
- ✅ **修正済み**: `vercel.json`を削除
- Vercelの自動検出に任せる

### ピア依存関係エラーが発生した場合
- Install Command Overrideが正しく設定されているか確認
- `npm install --legacy-peer-deps`が指定されているか確認

### ビルドエラーが発生した場合
- ローカルで`pnpm run build`が成功していることを確認
- 環境変数が正しく設定されていることを確認

## 7. 現在の状態 ✅

- ✅ 依存関係修正完了
- ✅ TypeScriptエラーなし
- ✅ Next.jsビルド成功
- ✅ package.json修正保持
- ✅ 環境変数設定確認済み
- ✅ vercel.json削除（Next.js自動検出を利用）
- ✅ Client Component修正完了

コード自体に問題はなく、すべての準備が完了しています。 