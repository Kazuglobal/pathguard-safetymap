# /run-safe-magazine-team - SAFE MAGAZINE チーム実行

通学路安全ニュースのコンテンツを自動更新するエージェントチームを実行します。
編集方針の詳細は `.claude/commands/safe-magazine-update.md`（編集ミッション・テンプレートT1〜T6・必須ルール）を正とします。

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
- `follow-up` - 続報のみ（Phase 0 の候補だけを記事化）

---

## フェーズ依存関係

```
Phase 0 続報チェック（メインエージェントが実施）
   │
Phase 1 リサーチ（カテゴリ別に並列 Task 起動）───┐
   │                                             │
Phase 2 ファクトチェック（全リサーチ集約後に1回）◄┘  ← バリア: 全カテゴリの結果を待つ
   │
Phase 3 記事作成（APPROVED項目ごとに並列 Task 起動）
   │
Phase 4 ビジュアル設計（記事ごとに並列 Task 起動。Phase 3 と同じ記事単位でパイプライン可）
   │
Phase 5 画像生成（Bash 実行。全ビジュアル仕様が揃ってから1回）
   │
Phase 6 SEO最適化（記事ごと。Phase 3 完了後なら Phase 5 と並行可）
   │
Phase 7 公開統合と検証ゲート（メインエージェントが実施）
```

---

## Phase 0: 続報候補チェック（リサーチ前に必ず実施）

メインエージェント自身が以下を行う（サブエージェント不要）:

1. `content/safe-magazine/articles/` の一覧と `lib/safe-magazine.ts` の `ARTICLES` を確認する
2. 既存記事から続報候補を抽出する。判定基準:
   - **施行日が未来だった制度** → 施行後の運用実態が報じられていれば続報化（例: 自転車青切符の運用状況、30km/h規制の施行後）
   - **年次更新される統計** → 新しい年次データが公表されていれば続報化（例: 交通安全白書、警察庁の事故統計）
   - **進行中のモデル事業** → 進捗発表があれば続報化（例: ゾーン30プラスのモデル地域）
3. 続報候補リスト（トピック・前回記事slug・確認すべき新事実）を作成し、Phase 1 の該当リサーチャーへ引き継ぐ
4. 同時に既存記事のトピック一覧（重複除外リスト）も作成する

---

## Phase 1: カテゴリ別並列リサーチ

**$ARGUMENTS でカテゴリ指定がある場合は該当カテゴリのみ、`all` または未指定なら5カテゴリすべてを、1つのメッセージで並列に Task 起動する。**
`follow-up` 指定時は Phase 0 の続報候補のみを対象に1エージェントを起動する。

各エージェントへの起動プロンプト（`{category}` 部分をカテゴリごとに差し替え）:

```
subagent_type: "general-purpose"
prompt: |
  あなたは SAFE MAGAZINE の「ニュースリサーチャー」です。
  .claude/agents/news-researcher.md の指示に従い、担当カテゴリのみをリサーチしてください。

  担当カテゴリ: {category}（このカテゴリ以外は検索しない）

  【重複除外リスト】以下の既存トピックは除外すること:
  {Phase 0 で作成したトピック一覧}

  【続報候補】以下は重複ではなく「続報」として扱い、新事実の有無を必ず確認すること:
  {Phase 0 の続報候補のうち担当カテゴリ分}

  【時期の優先】現在は {今月} です。.claude/commands/safe-magazine-update.md の
  年間編集カレンダーで今の時期に該当するテーマを優先してください。

  【必須ルール】
  - WebSearch / WebFetch で実際に確認できた情報のみを報告する。URL実在・内容確認が必須
  - 推測・捏造は絶対禁止。確認できなかったものは含めない

  結果は content/safe-magazine/research/YYYY-MM-DD-research-{category}.json に保存してください。
```

**フォールバック**: あるカテゴリのリサーチ結果が0件でもフローは止めない。0件だったカテゴリを最終レポートに記録し、残りで続行する。全カテゴリ0件なら Phase 2 以降をスキップし、その旨を報告して終了する。

---

## Phase 2: ファクトチェック（バリア: 全リサーチ完了後に1回）

```
subagent_type: "general-purpose"
prompt: |
  あなたは SAFE MAGAZINE の「ファクトチェッカー」です。
  .claude/agents/fact-checker.md の指示に従い、
  content/safe-magazine/research/ の本日分リサーチ結果（research-*.json 全ファイル）を検証してください。

  各項目について:
  1. ソースURLに実際にアクセスして内容を確認する
  2. 信頼性を格付けする（公的統計/公式発表/報道/専門機関）
  3. 日付・場所・数値・調査年を確認する（時点が特定できない統計は NEEDS_REVISION）
  4. 複数ソースでクロスチェックする
  5. APPROVED / NEEDS_REVISION / REJECTED を判定する

  カテゴリをまたいで同一トピックが重複していたら1つに統合すること。

  検証結果を content/safe-magazine/research/YYYY-MM-DD-verified.json に保存してください。
```

**フォールバック**: APPROVED が0件の場合、(1) 続報候補があれば続報のみで Phase 3 へ進む、(2) それもなければ「本日は記事化できる検証済み情報なし」とレポートして終了する（無理に記事を作らない。事実性がすべてに優先する）。

---

## Phase 3: 記事作成（APPROVED項目ごとに並列 Task 起動）

APPROVED 項目1件につき1エージェントを起動する（3件を超える場合は関連性の高い順に最大3件まで）。

```
subagent_type: "general-purpose"
prompt: |
  あなたは SAFE MAGAZINE の「記事ライター」です。
  .claude/agents/article-writer.md と .claude/commands/safe-magazine-update.md の
  編集ミッション・必須ルールに従って、以下の検証済み情報から記事を1本作成してください。

  【検証済み情報】
  {verified.json の該当項目：事実・出典・格付け・データ時点}

  【編集方針（必ず全項目を満たす）】
  1. テンプレート選択: T1速報型/T2統計解説型/T3地域事例型/T4シリーズ追跡型/T5実践ガイド型/T6季節連動型 から選び、選択理由を作業メモに書く
  2. タイトル公式: 【いつ/誰に】+ 数字or固有名詞 + 読者ベネフィット（32字目安・最大40字）
  3. keyPoints は必ず3つ: ①数字入り最重要ファクト ②わが家への意味 ③今すぐできる行動
  4. リード3行: 「何が起きた/分かった」「わが家にどう関係」「読むと何ができる」
  5. 不安と行動のセット原則: 危険情報1つにつき「今すぐできる行動」1つ以上。行動なしの不安喚起は禁止
  6. わが家に翻訳: 全国統計・制度は学年別・状況別の影響まで書き分ける
  7. 全国ニュースなら「あなたの自治体で確認する方法」セクションを入れる
  8. 出典に格付け（[公的統計]等）とデータ時点（調査年・集計期間）を明記する
  9. 「また来たくなる仕組み」を最低3つ組み込む（関連記事リンク/シリーズタグ/学年別対象タグ/次回予告/アプリ連動CTA など）
  10. 続報記事の場合: 冒頭に「前回のおさらい」3行と前回記事リンク、tags に シリーズ:{名前} を必ず入れる

  【絶対禁止】
  - 検証済み情報にない事実・数値・引用の追加（事実の創作は一切禁止）
  - 既存記事との重複（重複除外リスト: {Phase 0 の一覧}）

  記事を content/safe-magazine/articles/YYYY-MM-DD-{slug}.md に保存し、
  ビジュアルデザイナー向けの image_requirements（サムネイル1点＋本文図解0〜2点の内容案）も末尾に記載してください。
```

---

## Phase 4: ビジュアル設計（記事ごとに並列。書き上がった記事から順次起動してよい）

```
subagent_type: "general-purpose"
prompt: |
  あなたは SAFE MAGAZINE の「ビジュアルデザイナー」です。
  .claude/agents/visual-designer.md の指示に従い、以下の記事のビジュアル仕様を作成してください。

  対象記事: content/safe-magazine/articles/{記事ファイル}

  【設計方針】
  - サムネイルは「恐怖で釣らない」。危険テーマでも教育的・前向きなトーンにする
  - カテゴリ別カラーとLucideアイコンはプロジェクト規約に従う
  - Gemini画像生成用の英語プロンプトを作成する。日本向け要素（黄色い通学帽・ランドセル・
    日本の住宅街・横断歩道・グリーンベルト・スクールゾーン標識）を含め、
    実在人物の顔・実在事故現場の再現・ブランドロゴは negative prompt で禁止する
  - scripts/generate-safe-magazine-images.ts の ImageConfig 形式
    （articleId/articleSlug/category/title/thumbnailPrompt/contentImages[]）でそのまま貼れる形で出力する

  仕様を content/safe-magazine/images/YYYY-MM-DD-{slug}-visual-spec.json に保存してください。
```

---

## Phase 5: 画像生成（全ビジュアル仕様が揃ってから、メインエージェントが実施）

1. Phase 4 の各 visual-spec から `ImageConfig` を `scripts/generate-safe-magazine-images.ts` の `ARTICLE_IMAGES` 配列に追記する
2. 実行する:
```bash
npx tsx scripts/generate-safe-magazine-images.ts
```
3. 出力確認: `public/images/safe-magazine/thumbnails/{slug}.png` と `public/images/safe-magazine/articles/{slug}/*.png` が実在するか `ls` で確認する

**フォールバック**:
- 生成失敗（APIエラー・クォータ）→ 1回だけリトライ。それでも失敗したら該当記事の `thumbnailUrl` は設定せず（UI側はサムネイルなしでも表示可能）、失敗した画像の一覧を最終レポートに記録する。フローは止めない
- `GEMINI_API_KEY` 未設定 → 画像生成をスキップして続行し、レポートに「画像未生成」と明記する（.env.local を開いて確認しないこと。ユーザーに設定状況を尋ねる）

---

## Phase 6: SEO最適化（記事ごと。Phase 5 と並行可）

```
subagent_type: "general-purpose"
prompt: |
  あなたは SAFE MAGAZINE の「SEOスペシャリスト」です。
  .claude/agents/seo-specialist.md の指示に従い、以下の記事のSEO最適化を行ってください。

  対象記事: content/safe-magazine/articles/{記事ファイル}

  - メタタイトル（60字以内）・メタディスクリプション（120〜160字、行動喚起を含む）
  - JSON-LD（NewsArticle）と OGP/Twitter Card 設定
  - 既存記事（lib/safe-magazine.ts の ARTICLES）との内部リンク提案（最低1本、シリーズ記事があれば必須）
  - slug の妥当性確認（英小文字ハイフン区切り・既存slugと非重複）

  結果を記事ファイルに反映し、変更点を報告してください。
```

---

## Phase 7: 公開統合と検証ゲート（メインエージェントが実施。ここを飛ばすと記事はアプリに表示されない）

1. **記事登録**: `lib/safe-magazine.ts` の `ARTICLES` 配列に新記事オブジェクトを追加する（title/excerpt/category/tags/content/sources/keyPoints/thumbnailUrl/contentImages。tags には `対象:*`・`シリーズ:*` 規約を反映）
2. **ランディング更新**: トップに出す場合のみ `lib/landing-safe-magazine-preview.ts` を更新する
3. **検証ゲート**（すべて緑になるまで完了と言わない）:
```bash
npx vitest run tests/unit/lib/safe-magazine-release-readiness.test.ts
npx tsc --noEmit
```
4. **表示確認**: `rm -rf .next/cache` → `npm run dev` → 一覧・詳細・サムネイル表示をブラウザ確認（Ctrl+Shift+R）

---

## 最終レポート（必須項目）

- 作成記事一覧（テンプレート種別・カテゴリ・組み込んだ「また来たくなる仕組み」つき）
- 続報候補リストの更新版（今回続報化したもの／次回に持ち越すもの）
- リサーチ0件だったカテゴリ、REJECTED になった項目と理由
- 画像生成の成否（失敗があれば一覧）
- 検証ゲートの実行結果（実際のコマンド出力）
- 次回更新の推奨テーマ（年間編集カレンダー準拠）

---

## 実行例

```
User: /run-safe-magazine-team safety-tips

Claude: SAFE MAGAZINEチームを起動します。
対象カテゴリ: safety-tips (防犯・安全対策)

[Phase 0] 続報候補チェック... 既存10記事を確認。続報候補2件（青切符運用状況、ゾーン30プラス進捗）
[Phase 1] リサーチャー起動（safety-tips + 続報候補）...
[Phase 2] ファクトチェック... 6件中4件APPROVED
[Phase 3] 記事ライター2体を並列起動...
[Phase 4] ビジュアルデザイナー2体を並列起動...
[Phase 5] 画像生成... 4枚成功
[Phase 6] SEO最適化...
[Phase 7] lib/safe-magazine.ts へ登録 → vitest緑 → tsc緑 → 表示確認OK

完了しました。
- 作成記事: 2件（T5実践ガイド型 / T4シリーズ追跡型）
- 続報候補の持ち越し: 1件
- 次回推奨テーマ: 薄暮時間帯の事故（10月に向けた季節連動）
```
