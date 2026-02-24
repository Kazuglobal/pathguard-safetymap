# Responsive Design Testing with Playwright

このドキュメントは、PathGuardian（学校安全マップアプリケーション）のレスポンシブデザインテストの詳細な設定と使用方法を説明します。

## 概要

Playwrightを使用して、すべてのページで包括的なレスポンシブデザインテストを実装しました。このテストスイートは以下の機能を提供します：

- 13個の主要ページでのマルチビューポートスクリーンショットテスト
- モバイル、タブレット、デスクトップでのレイアウト検証
- タッチターゲットサイズとアクセシビリティチェック
- 日本語テキストの表示確認
- インタラクティブ要素の動作テスト

## 対象ページ

### 公開ページ
- **Landing Page** (`/landing`) - メインエントリーポイント
- **Login** (`/login`) - ログインフォーム
- **Register** (`/register`) - 新規登録フォーム

### メインアプリケーション
- **Dashboard** (`/dashboard`) - ユーザーダッシュボード
- **Map** (`/map`) - インタラクティブマップ
- **Missions** (`/missions`) - ミッション一覧
- **Badges** (`/badges`) - バッジシステム
- **Leaderboard** (`/leaderboard`) - ランキング

### インタラクティブ機能
- **Hazard Game** (`/hazard-game`) - 危険予測ゲーム
- **Route Quiz** (`/route-quiz`) - ルートクイズ

### 特別ページ
- **X-Road** (`/xroad`) - API統合
- **Admin Dashboard** (`/admin/dashboard`) - 管理者ダッシュボード

## テストビューポート

### モバイル
- **iPhone SE**: 375x667px
- **iPhone 12**: 390x844px  
- **Samsung Galaxy**: 360x740px

### タブレット
- **iPad**: 768x1024px
- **iPad Landscape**: 1024x768px

### デスクトップ
- **Full HD**: 1920x1080px
- **Standard**: 1366x768px
- **Firefox/Safari**: クロスブラウザテスト対応

## テスト実行方法

### 基本コマンド

```bash
# 全レスポンシブテストを実行
npm run test:responsive

# ブラウザを表示してテスト実行
npm run test:responsive:headed

# モバイルのみテスト
npm run test:responsive:mobile

# タブレットのみテスト  
npm run test:responsive:tablet

# デスクトップのみテスト
npm run test:responsive:desktop

# 特定のテストファイルのみ実行
npx playwright test tests/responsive/landing-page.spec.ts

# 特定のビューポートでテスト
npx playwright test --project="Mobile Chrome - iPhone 12"
```

### 開発中のテスト実行

```bash
# 開発サーバーを起動してからテスト実行
npm run dev &
npm run test:responsive

# または、設定によりサーバーが自動起動されます
```

## テスト内容

### 1. レイアウト検証
- 要素のオーバーフロー検出
- レスポンシブグリッドレイアウトの確認
- 画像の適切な縮小確認

### 2. タッチターゲットサイズ (モバイル)
- ボタン: 最小44x44px
- リンク: 最小44x44px  
- フォーム要素: 最小44px高さ

### 3. フォーム要素
- 入力フィールドの適切な幅
- ラベルとの関連付け
- バリデーションメッセージの表示

### 4. ナビゲーション
- モバイルハンバーガーメニュー
- タブレット/デスクトップメニュー
- ページ間遷移の確認

### 5. 日本語対応
- フォントレンダリング
- テキストの折り返し
- 文字切れの確認

## 設定ファイル

### `playwright.config.ts`
- ベースURL: `http://localhost:3000`
- タイムアウト: 30秒
- スクリーンショット閾値: 0.2
- 複数ブラウザプロジェクト設定

### テストヘルパー
- **`responsive-helpers.ts`**: レスポンシブテスト共通関数
- **`auth-helpers.ts`**: 認証関連ユーティリティ
- **Page Objects**: 再利用可能なページ要素定義

## スクリーンショット生成

テスト実行により、以下の場所にスクリーンショットが生成されます：

```
test-results/
├── landing-page-iphone-se.png
├── landing-page-iphone-12.png
├── landing-page-ipad.png
├── landing-page-desktop-hd.png
└── ... (他のページと各ビューポート)
```

### スクリーンショット比較
- 初回実行: ベースラインスクリーンショット作成
- 以降の実行: ベースラインとの比較
- 差分検出時: 詳細な差分レポート生成

## トラブルシューティング

### よくある問題

1. **認証エラー**
   ```bash
   # テストユーザーの設定確認
   # tests/utils/auth-helpers.ts の TEST_USERS を確認
   ```

2. **マップ読み込みエラー**
   ```bash
   # Mapbox トークンの設定確認
   # 環境変数 NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
   ```

3. **スクリーンショット差分**
   ```bash
   # 既存スクリーンショットを更新
   npx playwright test --update-snapshots
   ```

4. **ブラウザ依存関係エラー**
   ```bash
   # Linux/WSL の場合
   sudo npx playwright install-deps
   ```

## カスタマイゼーション

### 新しいビューポート追加

`playwright.config.ts` の `projects` セクションに追加:

```typescript
{
  name: 'Custom Mobile',
  use: { 
    viewport: { width: 414, height: 896 } // iPhone 11 Pro
  },
}
```

### 新しいページテスト追加

1. `tests/responsive/` に新しい `.spec.ts` ファイルを作成
2. `testPageResponsiveness` ヘルパーを使用
3. カスタムチェック関数を実装

### テスト条件カスタマイズ

`responsive-helpers.ts` の設定を調整:
- タッチターゲット最小サイズ
- スクリーンショット閾値
- ビューポート固有のテスト条件

## CI/CD統合

GitHub Actionsなどでの自動実行設定例:

```yaml
- name: Run Responsive Tests
  run: |
    npm run build
    npm run test:responsive
    
- name: Upload Screenshots
  uses: actions/upload-artifact@v3
  if: failure()
  with:
    name: screenshot-diff
    path: test-results/
```

## パフォーマンス最適化

- 並列実行によるテスト高速化
- スクリーンショット比較の最適化
- 認証状態の再利用

このテストスイートにより、PathGuardianのすべてのページが様々なデバイスで適切に表示され、優れたユーザーエクスペリエンスを提供することが保証されます。