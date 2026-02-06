# /run-safe-magazine-team - SAFE MAGAZINE チーム実行

通学路安全ニュースのコンテンツを自動更新するエージェントチームを実行します。

## 使用方法
```
/run-safe-magazine-team [カテゴリ]
```

カテゴリ (オプション):
- `all` - 全カテゴリ (デフォルト)
- `accident-news` - 事故ニュース
- `volunteer-activity` - 見守り活動
- `safety-tips` - 防犯・安全対策
- `danger-ranking` - 危険度ランキング
- `policy-update` - 施策・制度

---

## チーム実行ワークフロー

以下の4つのエージェントを順番に実行してください:

### Phase 1: リサーチ (並列実行可能)

Task tool で `news-researcher` エージェントを起動:

```
subagent_type: "general-purpose"
prompt: |
  あなたは「ニュースリサーチャー」です。
  .claude/agents/news-researcher.md の指示に従って、
  通学路安全に関する最新ニュースを収集してください。

  対象カテゴリ: $ARGUMENTS または all

  WebSearch と WebFetch を使用して以下を検索:
  1. "通学路 事故 2026" - 最新の事故ニュース
  2. "通学路 見守り ボランティア" - 見守り活動
  3. "子ども 防犯 対策" - 安全対策情報
  4. "交差点 危険度 ランキング" - 危険度データ
  5. "通学路 安全対策 自治体" - 施策情報

  結果を content/safe-magazine/research/ に保存してください。
```

### Phase 2: ファクトチェック

Phase 1 完了後、Task tool で `fact-checker` エージェントを起動:

```
subagent_type: "general-purpose"
prompt: |
  あなたは「ファクトチェッカー」です。
  .claude/agents/fact-checker.md の指示に従って、
  content/safe-magazine/research/ のリサーチ結果を検証してください。

  各ニュース項目について:
  1. ソースの信頼性を評価
  2. 複数ソースでクロスチェック
  3. 日付・場所・数値を確認
  4. 記事化の可否を判定 (APPROVED/REJECTED)

  検証結果を content/safe-magazine/research/ に保存してください。
```

### Phase 3: 記事作成

Phase 2 で APPROVED された項目について、Task tool で `article-writer` エージェントを起動:

```
subagent_type: "general-purpose"
prompt: |
  あなたは「記事ライター」です。
  .claude/agents/article-writer.md の指示に従って、
  ファクトチェック済みの情報から記事を作成してください。

  記事タイプ:
  - ニュース記事: 事実ベースの速報
  - ガイド記事: 実践的なアドバイス
  - 解説記事: データの読み解き

  記事を content/safe-magazine/articles/ に保存してください。
```

### Phase 4: ビジュアル設計

Phase 3 完了後、Task tool で `visual-designer` エージェントを起動:

```
subagent_type: "general-purpose"
prompt: |
  あなたは「ビジュアルデザイナー」です。
  .claude/agents/visual-designer.md の指示に従って、
  作成された記事に必要なビジュアル要素を設計してください。

  作成するもの:
  1. サムネイル画像の仕様
  2. インフォグラフィックの設計
  3. 必要なUIコンポーネントの提案

  仕様を content/safe-magazine/images/ に保存してください。
```

---

## 実行例

```
User: /run-safe-magazine-team safety-tips

Claude: SAFE MAGAZINEチームを起動します。
対象カテゴリ: safety-tips (防犯・安全対策)

[Phase 1] ニュースリサーチャーを起動中...
[Phase 2] ファクトチェッカーを起動中...
[Phase 3] 記事ライターを起動中...
[Phase 4] ビジュアルデザイナーを起動中...

完了しました。
- 収集ニュース: 8件
- ファクトチェック通過: 5件
- 作成記事: 3件
- ビジュアル仕様: 3件
```
