# SAFE MAGAZINE Daily Update Skill

## Description
SAFE MAGAZINE（通学路の安全NEWS）の日次更新を自動化するスキル。
記事画像の生成、SEO最適化、コンテンツ更新を一括で実行します。

## Trigger
- User says: "safe magazine 更新", "記事を更新", "画像を生成", "/safe-magazine-update"
- Daily scheduled update

## Workflow

### Step 1: 画像生成スクリプトの実行
Gemini 3 Pro Image Preview モデルを使用して、日本人向けの高品質画像を生成します。

```bash
cd c:/Users/s1598/mapsefe/20250615 && npx tsx scripts/generate-safe-magazine-images.ts
```

### Step 2: 生成される画像
以下の画像が自動生成されます：

**サムネイル画像（3枚）:**
- `public/images/safe-magazine/thumbnails/chikushino-accident.png`
- `public/images/safe-magazine/thumbnails/school-route-safety-statistics.png`
- `public/images/safe-magazine/thumbnails/nagara-mimamori-guide.png`

**記事内画像（5枚）:**
- `public/images/safe-magazine/articles/chikushino-accident/hard-vs-soft.png`
- `public/images/safe-magazine/articles/school-route-safety-statistics/grade-comparison.png`
- `public/images/safe-magazine/articles/school-route-safety-statistics/progress-circle.png`
- `public/images/safe-magazine/articles/nagara-mimamori-guide/nagara-examples.png`
- `public/images/safe-magazine/articles/nagara-mimamori-guide/hachimitsu-jiman.png`

### Step 3: キャッシュクリア
Next.js のキャッシュをクリアして新しい画像を反映します。

```bash
rm -rf .next/cache
```

### Step 4: 確認
開発サーバーを起動して画像が正しく表示されることを確認します。

```bash
npm run dev
```

## 画像生成プロンプトのガイドライン

### 日本向け要素
- 黄色い帽子（通学帽）
- ランドセル（赤/黒）
- 日本の住宅街
- 横断歩道
- グリーンベルト（路側帯）
- ガードレール
- スクールゾーン標識
- 緑のおばさん（交通指導員）
- 見守りボランティア
- 柴犬

### スタイル設定
- アニメ/マンガ風イラスト
- 温かみのある色調
- 教育コンテンツに適した親しみやすいデザイン
- ウォーターマーク・テキストなし

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `scripts/generate-safe-magazine-images.ts` | 画像生成スクリプト |
| `lib/safe-magazine.ts` | 記事データ定義 |
| `lib/seo-generator.ts` | SEOメタデータ生成 |
| `components/landing/SafetyNewsSection.tsx` | ランディングページの表示 |
| `app/safe-magazine/page.tsx` | 記事一覧ページ |
| `app/safe-magazine/[slug]/page.tsx` | 記事詳細ページ |
| `app/safe-magazine/[slug]/ArticleContent.tsx` | 記事コンテンツ表示 |

## 環境変数

`.env.local` に以下を設定：

```
GEMINI_API_KEY=your-api-key
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
```

## エージェントチーム

`.claude/teams/safe-magazine-team.json` で定義されたエージェント：

1. **ニュースリサーチャー** - 最新ニュースの収集
2. **ファクトチェッカー** - 情報の正確性検証
3. **記事ライター** - 記事執筆
4. **エディター** - 記事の編集・校正
5. **画像ジェネレーター** - Geminiで画像生成
6. **SEOスペシャリスト** - SEO最適化

## トラブルシューティング

### 画像が表示されない場合
1. `.next` フォルダを削除
2. ブラウザキャッシュをクリア（Ctrl+Shift+R）
3. 開発サーバーを再起動

### API エラーの場合
1. `GEMINI_API_KEY` が正しく設定されているか確認
2. API クォータを確認
3. モデル名が正しいか確認（`gemini-3-pro-image-preview`）
