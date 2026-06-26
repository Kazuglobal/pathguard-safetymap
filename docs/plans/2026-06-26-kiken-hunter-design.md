# きけんハンター 設計・実装仕様書 v3

> ステータス: **v3 確定 / 初回ビルド = Phase 0（保存なし・探索モードのみPoC）にフルロック / 要決定A・B=決定済み / 実装着手可** / 2026-06-26
> 前提: PathGuardian（Next.js 16 + Supabase/PostGIS + Mapbox + Vercel）内の新モジュール `/safety-quest/hunter` として実装
> 経緯: 元設計書「通学路 危険発見ゲーム v1」→ コードベース調査と意思決定で確定（v1）→ **Codexレビューで子ども写真・位置情報・外部AIの安全要件を Phase 0 必須に引き上げ縮小（v2）**→ **Codexレビューの再評価で「安全ゲート」と「スコープ判断」を分離し、オンデバイスマスキング・第三者AI送信同意・ダブル空フォールバック・レート制限を追加（v3）**。

---

## v2→v3 変更点（Codexレビューの再評価を反映）

| # | 変更 | 理由 |
|---|---|---|
| B1 | **安全ゲートとスコープ判断を分離**。クイズ/バッジの後回しは「安全要件」ではなく「実装量の都合」と明記。クイズは探索と同じ写真・検出・位置を使うだけで**新たなプライバシー面は増えない** | Codexは両者を同列にPhase送りしていたが、クイズ延期は安全とは独立した順序判断 |
| B2 | **マスキングの第一候補をオンデバイス自動検出＋確認に変更**（純粋手動を既定にしない）。未マスク画像を端末外へ出さずに自動化 | 主ユーザーは低学年。自力マスクは塗り漏れ＝PII流出。最も能力の低い利用者に最重の判断を負わせない |
| B3 | **第三者AI送信・越境移転の同意を Phase 0 ゲートに追加** | 保存なしでもマスク済み写真をGemini（国外・第三者）へ送る。APPI上、保存より送信が大きいプライバシーイベントになりうる |
| B4 | 事故ライブラリは **Phase 0は薄いサーバヘルパー1個**、全面 client/server 分割は Phase 1 | 297行＋多数consumerの全面リファクタは回帰リスク過大でPhase 0便益が薄い |
| B5 | **ダブル空（事故0件＋AI検出0件）フォールバック**をゲーム設計に明記 | 静かな安全な道でタップ対象もクイズテーマもゼロ＝コアループ崩壊を防ぐ |
| B6 | `/api/hunter/analyze` に **Phase 0からレート制限** | 認証済みだが高コストなAIエンドポイント。乱用・コスト暴走対策 |

---

## 0. ステータスと No-Go 解除条件（最重要）

本機能は**未成年の写真・位置情報・外部AI利用**を伴うため、以下を満たすまで「保存あり・公開・学校配布」は **No-Go**。

### Phase 0 を着手するための必須前提（保存なしPoCでも必要）
- [ ] 子ども向け文言を「**安全判定**」ではなく「**気をつける練習**」に統一（AIの出力を断定的な安全保証として提示しない）
- [ ] 撮影/アップ前ガイド表示（顔・表札・ナンバー・他人が写らないように）
- [ ] **マスク済み画像のみ** AI解析へ送る（未マスク画像をサーバ保存・ログしない）
- [ ] **第三者AI送信・越境移転の同意**（B3）: マスク済みでも写真をGemini（国外・第三者）へ送ることを明示し同意を得る。保存とは別のゲート
- [ ] `/api/hunter/analyze` に**レート制限**（B6）: 認証済みだが高コストなAIエンドポイント。乱用・コスト暴走対策
- [ ] 認証必須（既存 `auth.getUser()` ガード踏襲）
- [ ] 既存不整合バグ2件を**実装前に修正**（§13 ブロッカー）

> **安全ゲート vs スコープ判断（B1）**: 上記の「マスク済みのみ送信・第三者AI同意・保存なし・レート制限・文言」は**安全ゲート**（満たすまで進めない）。一方、**AIクイズ／バッジ／記録**を後フェーズに置くかは安全要件ではなく**実装量の都合（スコープ判断）**。クイズは探索と同じ写真・検出・位置を使うだけで新たなプライバシー面を増やさないため、希望すれば Phase 0 に残せる（§14 注記）。

### 保存あり（Phase 1）を解除するための条件
- [ ] 非公開バケット `hunter-photos/{auth.uid()}/{photoId}/masked.webp`
- [ ] 所有者スコープRLS＋アプリ層認可（service_role使用時も所有者検証）
- [ ] **短TTL署名URL**配信（公開URL不使用）
- [ ] 削除API＋保持期限（リテンション）＋監査ログ
- [ ] 明示的な保護者同意フロー

### 学校・自治体利用（Phase 3）
- 同意・管理ビュー・監査が揃うまで**対象外**。

---

## 1. v1→v2 で変更した意思決定

| 項目 | v1（前回決定） | v2（Codexレビュー反映） | 備考 |
|---|---|---|---|
| 写真の保存 | Supabase暗号保存（初回から） | **初回PoCは原則保存なし**。保存はPhase 1（RLS/削除/監査/短TTL署名URL揃ってから） | 価値検証を保存より先に |
| モード範囲 | 探索＋クイズ両方（初回から） | **Phase 0は探索のみ**。AIクイズは**Phase 2** | クイズ生成API/UIは後段 |
| マスキング | 「Geminiで自動マスキング」 | **ブラウザで手動確認/手動マスク**を既定。マスク済みのみAI解析。サーバ一時処理する場合は未マスク非保存・ログ禁止・即時破棄・明示同意を必須の別案 | 自動検出は精度未検証のため断定しない |
| ステータス | 確定（実装承認待ち） | **No-Go解除条件付き** | §0 |
| 主導線 | `safety-quest-client.tsx` に大型追加 | **`/app/safety-quest/hunter/page.tsx` ＋ `components/safety-quest/hunter/*`** に分離（巨大単一ファイルへの追加禁止） | 保守性 |
| 文言 | 「安全度」表現 | 「**気をつける練習**」に統一 | 断定回避 |

> v1 で確定済みのまま据え置く決定: ベース=`/safety-quest`、位置=地図ピン、事故反映=コンテキスト表示＋AI注入、報酬=コレクション寄り、エリア=制限なし＋フォロー文、AIモデル=座標を返す既存Geminiパイプライン流用。

---

## 2. 概要

子どもが**自分の通学路の写真**をアップロードし、**地図にピンを立てて場所を指定**すると、その地点周辺の**実際の事故データ**をもとにゲームが始まる。写真に潜む危険を、子ども自身が探したり（探索モード）、AIが事故データから出すクイズに答えたり（クイズモード／Phase 2）しながら「自分の通学路の危険に気づく練習」をする体験型ゲーム。

**設計の北極星**: 「正解を当てる」ゲームではなく「**危険に気づく目を育てる**」ゲーム。間違えても責めず、必ず学びと発見の手応えが残る。子ども向け文言は一貫して「気をつける練習」とし、安全を断定保証しない。

---

## 3. ターゲットと体験ゴール

| 項目 | 内容 |
|---|---|
| メインプレイヤー | 小学生本人（低学年でも操作できるUI・文言） |
| 想定シーン（初回PoC） | **家庭内 / 社内PoC**（学校・自治体は対象外） |
| 体験ゴール | ①「ここ、あぶないかも」と自分で気づく ②なぜ気をつけるか言葉で理解 ③通学路への当事者意識 |
| 1プレイ時間 | 1枚あたり 1〜3分 |

---

## 4. 体験フロー（Phase 0 = 保存なし探索PoC）

```
写真をえらぶ → マスク確認（手動確認/手動マスク）→ 地図でピン → 解析中
   → この付近の「気をつけるカード」（事故統計）
   → 探索モード（タップで危険発見・採点・やさしい解説）
   → 結果（スコア・気づいた数）
   ※ 写真はこの間メモリ上のみ。保存しない。
```

Phase 2 でモード選択にAIクイズを追加。

画面構成（Phase 0 最小）:
1. きけんハンター ホーム（はじめる）
2. 写真選択（カメラ起動 or ライブラリ）
3. **マスク確認**（顔・表札・ナンバーを手動でぼかし確認／キャンセル可）
4. ピン設置（Mapbox）
5. 解析中（短いローディング演出）
6. 探索プレイ（写真＋タップUI）
7. 結果（スコア・気づいた数）

---

## 5. ゲームの2モード

### モードA: 探索モード（Phase 0）
- 写真の危険だと思う場所を指でタップ → AI検出結果と照合 → **当たり / 惜しい / もう一回**。
- 発見時に「なぜ気をつけるか」をやさしい言葉で表示。
- 当たり判定は**検出領域を少し広めに取ったゾーン判定**（ピクセル精度に頼らない）。
- 否定しない設計: 外しても減点せず「ここは安全そうだね / 近いよ！」。

### モードB: AIクイズモード（Phase 2）
- ピン周辺の事故タイプ集計を**出題テーマ**に。多いテーマ優先。
- 写真内に該当 hazard があれば「その場所をタップ」、なければ4択で安全行動を問う。
- 「実際にこのあたりで◯件起きているよ」のリアリティ一言（件数と種類のみ）。

> 2モードは**同じ写真・同じ検出結果を共有**。検出は1回だけ走らせキャッシュ（保存ありPhaseではDBキャッシュ、保存なしPhaseはセッション内メモリ）。

---

## 6. AI画像認識の設計（心臓部）

### 6.1 役割
マスク済み写真をAIに渡し、危険箇所を構造化データで返す。タップ採点とクイズ生成の土台。

### 6.2 入力
- **マスク済み**写真画像（リサイズ後）
- コンテキスト: ピン周辺の事故タイプ要約（PostGIS RPC `get_nearby_accident_stats`）
- 子ども向けプロンプト指定（既存 `child` モード）

### 6.3 API/型設計（Codex指摘反映）
- `analyzeImagePipeline(image, options)` へ拡張。`options = { accidentContext?, promptType?, purpose? }`。
  - `purpose`: `"hunter-explore"` 等。ログ/コスト計測の区別に使用。
- 出力の `DetectionItem.positions[]` は **flatten** して `HunterHazard[]` に変換:
  - **安定ID付与**（`{photoSessionId}-{detIndex}-{posIndex}` 等の決定的ID）。
  - **confidence閾値**で低信頼を除外（既定 0.5、出題は更に高め）。
  - **空検出時の挙動を明記**（hazard 0件なら「危険は見つからなかった。でも油断は禁物」フォロー＋一般安全行動へ）。

#### HunterHazard（内部表現）
```jsonc
{
  "id": "sess123-2-0",
  "type": "見通しの悪い交差点",
  "region": { "x": 0.42, "y": 0.55, "w": 0.18, "h": 0.20 }, // 相対 0〜1
  "severity": "high",
  "kid_explanation": "曲がってくる車から、きみが見えにくい場所だよ。",
  "safe_action": "一回とまって、車が来ないか左右をよく見よう。",
  "confidence": 0.81
}
```

### 6.4 採点ロジック（探索モード）
- タップ座標を相対化 → 各 hazard region に内包されるか判定。
- 内包 → **当たり**、region の少し外（許容マージン内）→ **惜しい**、別領域 → 否定せず「安全そうだね」。
- **採点はサーバ側で再計算**（§8、クライアント点数を信用しない）。

### 6.5 精度リスクと対策
| リスク | 対策 |
|---|---|
| bbox がズレる/不安定 | 粗いゾーン判定。当たり領域を少し広めに |
| 誤検出 | confidence閾値でフィルタ。低信頼は出題から除外 |
| 解析が遅い/高い | 1写真1回だけ解析しキャッシュ。`purpose`でコスト計測 |
| 子どもに不適切な表現 | 「やさしい言葉・否定しない・断定しない」プロンプト制約。NGワードフィルタ |

### 6.6 マスキング（プライバシー前処理）— 第一候補はオンデバイス自動＋確認（B2）

主ユーザーは低学年の小学生。**自力で顔・表札・ナンバーを見つけて塗る運用は塗り漏れ＝PII流出**になりやすく、最も能力の低い利用者に最重の判断を負わせるため、純粋手動を既定にしない。

方式の優先順位:

1. **【第一候補】オンデバイス自動検出＋確認**: ブラウザ内（`FaceDetector` API / MediaPipe / face-api.js 等）で**端末内**で顔等を検出→自動ぼかし→子ども/保護者がプレビュー確認・追加塗り可。**未マスク画像を端末外へ一切出さない**ため、第三者AI送信前にPIIを落とせる。検出が不確実なときは**より広めにぼかす**側へ倒す。
   - 制約: ナンバープレート・表札は顔検出より難度が高い。これらは手動塗り＋ガイドで補完。
2. **【併用】手動マスク確認**: 自動結果に対し、子ども/保護者が矩形で追加のぼかしを足せる。最終的に**マスク済み画像のみ**をAI解析へ送信。
3. **【別案・非推奨】サーバ/外部AI補助マスキング**: 未マスク画像を一旦外部へ送る方式。採用時は **未マスク非保存・ログ禁止・即時破棄・明示同意** を必須条件。「Geminiで自動マスキング」と断定する設計にはしない（検出精度未検証＋未マスク送信が発生するため第一候補にしない）。

- `masking.ts` は領域→ブラー演算・「不確実なら広め」判定など**純粋部分をテスト対象**に、検出器呼び出しと canvas 適用はブラウザ層。

#### 検出器ライブラリ（決定 — 要決定A）
- **第一候補: MediaPipe Tasks Vision の FaceDetector**（`@mediapipe/tasks-vision`、**動的import・遅延ロード**）。WASMで端末内推論。精度・保守性が最良。解析画面でのみロードし初期バンドルを汚さない。
- **機会的高速パス**: ネイティブ `FaceDetector`（Shape Detection API）が存在する環境ではそれを先に試し、無ければ MediaPipe へフォールスルー。
- **ナンバー・表札**: 信頼できるオンデバイスモデルが無いため**手動矩形ぼかし＋ガイド**で補完。
- **フォールバック**: 検出器のロード失敗・非対応時は**手動マスクを必須**にしてから送信（黙って未マスク送信しない）。検出 boxは「不確実なら広め」にマージン拡張。
- モデル資産（WASM/`.task`）は public 配信し、CSP/オフライン考慮。

---

## 7. 事故データ連携（ピン → 近傍事故 → カード/出題）

### 7.1 既存資産の再利用
- テーブル `traffic_accidents`（約153万件・PostGIS・SRID4326）。
- RPC `get_nearby_accident_stats(p_latitude, p_longitude, p_radius_meters, p_years)` → `risk_score`・`nearest_accidents`・`by_accident_type` 等。
- 座標慣習: **`[lng, lat]`**（スカラーは `latitude`/`longitude` 個別名）。

### 7.2 traffic-accident-data.ts の client/server 問題（Codex指摘 + B4で段階化）
現状 `lib/traffic-accident-data.ts` は `"use client"`（ブラウザ supabase クライアント依存）。API ルート（nodejs）から使えない。

- **【Phase 0／B4】薄いサーバヘルパー1個のみ**を新設し、全面リファクタはしない:
  - `lib/traffic-accident/server.ts` — `createServerClient` 経由で `get_nearby_accident_stats` を呼ぶ最小関数。型は既存ファイルから型のみ import（値は持ち込まない）。
  - 既存 `lib/traffic-accident-data.ts`（297行・多数consumer）は**触らない**＝回帰リスクを避ける。
- **【Phase 1】全面 client/server 分離**（回帰テストを伴って実施）:
  - `lib/traffic-accident/shared.ts`（型・`getAccidentRiskLevel`・`getTimeSlotLabel` 等の純粋部分）
  - `lib/traffic-accident/client.ts`（`"use client"` ラッパー、既存互換）
  - `lib/traffic-accident-data.ts` は re-export シムに。

### 7.3 カード/出題への変換
1. 近傍事故をタイプ別集計（`by_accident_type`）。
2. 「気をつけるカード」: `risk_score`（🟢🔵🟡🟠🔴）・子ども関与件数・最多事故類型・ピーク時間帯をやさしい言葉で表示（断定しない）。
3. （Phase 2）多いタイプを出題テーマに。該当 hazard があれば場所を、なければ安全行動を問う。
4. データ0件 → 「記録はないけど油断は禁物」フォロー文。

### 7.4 ダブル空フォールバック（B5）
**事故0件 ＋ AI検出0件**（静かで安全な道）の場合、タップ対象もクイズテーマもゼロでコアループが崩壊する。これを防ぐ:
- **汎用ハザード・ライブラリ**: 写真に依存しない一般的な「気をつけるポイント」（飛び出し・信号・横断・車のかげ等）の小さな固定セットを用意し、検出が空のときはそこから出題/提示。
- **逆モード（任意）**: 「安全な工夫（ガードレール・歩道・ミラー）を探そう」という肯定形ミッションに切替。
- いずれも「**この道は危険が少ないね。でも油断は禁物**」という肯定的フォローを添える（否定しない設計）。

---

## 8. API/サーバ設計

```
POST /api/hunter/analyze   (nodejs, 認証必須)
  入力: マスク済み imageBase64, pin {latitude, longitude}
  処理: zod検証 → 事故統計(server RPC) → analyzeImagePipeline(image, {accidentContext, promptType:"child", purpose:"hunter-explore"})
        → DetectionItem flatten → HunterHazard[]（安定ID・confidence閾値・空検出フォロー）
  返却: hazards[], accidentSummary, (Phase2) quizThemes
  ※ Phase 0: 画像を保存しない。Phase 1: マスク済みのみ非公開バケット保存＋hazard_detectionsキャッシュ。

POST /api/hunter/session   (nodejs, 認証必須)
  入力: photoSessionId, mode, タップ/クイズ回答
  処理: 所有者検証 → **サーバ側で再採点**（クライアント点数を信用しない）→ 記録/バッジ（Phase1+）
  返却: score, awardedBadges
```

- 入力検証は zod を**純粋関数に切り出し**てユニットテスト対象に。
- AI/RPC/Storage 失敗時は graceful degrade（ゲーム継続 or 明確な日本語エラー）。
- **`/api/hunter/analyze` はレート制限必須（B6）**: 認証済みだが高コスト。既存 `lib/upstash-rate-limiter.ts`（`checkGeminiRateLimit` 相当）を適用し、429＋`Retry-After` を返す。
- サーキットブレーカー・多段フォールバックは既存慣習（`lib/openai.ts`/`lib/upstash-rate-limiter.ts`）準拠。
- service_role を使う処理でも**アプリ層で所有者認可**を必ず実施。

---

## 9. データモデル（Supabase）— Phase 1 以降

> Phase 0（保存なしPoC）では作成しない。保存ありに進む段階で導入。

| テーブル | 主なカラム | 用途 | 導入Phase |
|---|---|---|---|
| `hunter_photos` | id, player_id, image_path(`{uid}/{photoId}/masked.webp`), pin_lat, pin_lng, captured_at, exif_stripped, masked, retention_until, created_at | マスク済み写真とピン | 1 |
| `hazard_detections` | id, photo_id(FK), type, region(jsonb), severity, kid_explanation, safe_action, confidence, model, created_at | AI検出キャッシュ | 1 |
| `hunter_sessions` | id, player_id, photo_id(FK), mode(explore/quiz), score, combo_max, started_at, finished_at | プレイ記録 | 2 |
| `hunter_taps` | id, session_id(FK), x, y, matched_detection_id, result(hit/near/miss), points | 探索タップ | 2 |
| `hunter_quiz_items` | id, session_id(FK), theme, question, choices(jsonb), answer, is_correct, accident_ref(jsonb) | クイズ | 2 |
| `hunter_badges` | id, player_id, badge_code, earned_at | バッジ | 2 |
| `hunter_audit_log` | id, actor_id, action, target_id, created_at | 監査ログ | 1 |

- ストレージ: 非公開バケット `hunter-photos`（MIME/サイズ制限・所有者スコープRLS・**短TTL署名URL**）。
- 削除API・保持期限・監査ログを Phase 1 必須化。

---

## 10. 技術アーキテクチャ

```
[子どもの端末/ブラウザ]
   │ 写真選択 → canvas手動マスク確認 → ピン設置 → タップ
   ▼
[Frontend: /app/safety-quest/hunter/page.tsx + components/safety-quest/hunter/*]
   │ Mapbox ピンUI / 画像前処理（リサイズ・手動ぼかし）
   ▼
[API Routes (nodejs)]
   │ /api/hunter/analyze : マスク済み画像 + ピン → 事故統計 → AI検出 → HunterHazard[]
   │ /api/hunter/session : サーバ再採点（クライアント点数を信用しない）
   ▼
[Supabase: Postgres(PostGIS) + (Phase1)非公開Storage + Auth + RLS + 監査]
```

- 既存巨大ファイル `safety-quest-client.tsx` への大型追加は**禁止**。新導線は専用ルート＋専用コンポーネント群。
- AI呼び出しはサーバ側に隠蔽（APIキーをクライアントに出さない）。

---

## 11. ゲーミフィケーション

- ポイント: 危険発見＝得点。重大度が高いほど高得点。コンボ: 連続正解で倍率。
- バッジ（Phase 2、`hunter_badges`）: 「はじめての発見」「交差点マスター」等。
- 危険マップ素地（Phase 2）: 発見地点をDB蓄積（地図ビュー育成は後段）。
- 否定しない設計: ミスは減点でなく「もう一回チャンス」。低学年配慮: 文字少なめ・読み仮名・音/アニメ。競争要素はOFF。

---

## 12. 安全・プライバシー（最重要）

- **写り込み**: 顔・表札・ナンバーを**オンデバイス自動検出＋確認**で落とす（B2）。低学年に自力マスクを強いない。「人やお家の名前が写らないように撮ろうね」ガイド併用。
- **第三者AI送信・越境移転（B3）**: マスク済みでも写真を Gemini（国外・第三者）へ送るため、保存とは別に**送信の同意ゲート**を設ける。APPI上は保存より送信が大きいプライバシーイベントになりうる。未マスク画像は外部へ出さない（オンデバイスでマスク後に送信）。
- **保存**: Phase 0は保存なし。Phase 1は非公開バケット＋暗号化＋所有者スコープRLS＋短TTL署名URL＋削除API＋保持期限＋監査ログ。未マスク画像は一切保存・ログしない。
- **位置情報**: ピン座標は所有者のみ参照。事故統計照会に使用。共有/公開デフォルトOFF。
- **同意**: 保護者同意前提（保存あり段階で明示フロー）。学校利用の同意設計は Phase 3。
- **第三者の写り込み**: 大きく写る場合は採点対象から除外/再撮影を促す（手動マスクで一次対応）。
- **文言**: 「安全判定/安全保証」ではなく「気をつける練習」。AI出力を断定的安全保証として提示しない。

---

## 13. 実装前ブロッカー（修正必須・Codex昇格）

実装着手前に既存不整合を修正する:
1. **markers vs userMarkers**: `safety-quest-client.tsx` `ArPhotoScreen` は `markers:[]` を送るが `/api/safety-quest/private-practice` は `body.userMarkers` を読む → マーカーが常に空。
2. **レスポンス不整合**: クライアントは `body.score.pointsAwarded` を読むが API は top-level `pointsAwarded` を返す。

---

## 14. MVPフェーズ分け（v2）

| フェーズ | 範囲 | 保存 | テスト前提 |
|---|---|---|---|
| **Phase 0** | 既存 private-practice 契約修正、保存なし探索PoC、手動マスク確認、手動ピン、AI危険検出、事故統計カード | なし | Unit + 基本Integration |
| **Phase 1** | 非公開保存、RLS、削除、監査、短TTL署名URL、検出キャッシュ | あり | Security/所有者検証/署名URL期限 |
| **Phase 2** | AIクイズ、バッジ、記録、危険マップ素地 | あり | クイズ採点/再採点 |
| **Phase 3** | 学校/自治体利用、同意・管理ビュー・監査、マスキング強化 | 厳格 | 同意・管理 |

> **注記（B1）**: AIクイズの Phase 2 配置は**安全要件ではなくスコープ判断**。クイズは探索と同じ写真・検出・位置を使うだけでプライバシー面を増やさない。希望すればクイズ採点（サーバ再採点）・出題生成を Phase 0 に前倒しできる（保存なしのままセッション内メモリで成立）。バッジ・記録・危険マップは保存依存のため Phase 2 のまま。

---

## 15. 実装計画（Phase 0 / 依存順・TDD）

| セット | 内容 | テスト |
|---|---|---|
| **0. ブロッカー修正** | §13 の private-practice 不整合2件を修正 | 既存テスト＋追加 |
| **1. ドメイン型** | `lib/hunter/types.ts`（HunterHazard, region{x,y,w,h}, mode, purpose 等） | — |
| **2. 純粋ロジック（並列）** | `accident-context.ts`（Stats→AI注入文＋カードサマリ＋(将来)テーマ）/ `scoring.ts`（タップ→hit/near/miss・コンボ・配点・サーバ再採点用）/ `detection-mapper.ts`（DetectionItem flatten→HunterHazard・安定ID・閾値・空検出）/ `masking.ts`（領域→ブラー演算・「不確実なら広め」判定）/ `fallback-hazards.ts`（ダブル空用の汎用ハザード・B5） | 各ユニット |
| **3. 事故サーバヘルパー（B4）** | `lib/traffic-accident/server.ts` 薄い RPC 呼び出し1個のみ。既存 `traffic-accident-data.ts` は触らない | 型import確認 |
| **4. Gemini拡張** | `gemini-hazard.ts`: `analyzeImagePipeline(image, options)` 化（accidentContext/promptType/purpose）。child プロンプトに事故傾向注入 | ユニット（プロンプト差分・後方互換） |
| **5. APIルート** | `/api/hunter/analyze`（保存なし＋**レート制限**B6＋第三者AI送信同意チェック）・`/api/hunter/session`（サーバ再採点）。zod検証を純粋関数化 | ユニット（検証・デグレード・レート制限）＋Integration |
| **6. UI（並列）** | `/app/safety-quest/hunter/page.tsx` ＋ `components/safety-quest/hunter/`: `MaskConfirm`(オンデバイス検出＋手動追加・B2)/`ConsentGate`(第三者AI送信同意・B3)/`LocationPinPicker`/`CareCard`(気をつけるカード)/`HunterExploreCanvas`/`HunterResultCard` | Playwright/Accessibility |
| **7. 検証＆最終** | 独立検証エージェント（仕様突合）→ `pnpm test`/`typecheck`/`lint` → スクショ | — |

---

## 16. テスト計画（Codex）

- **Unit**: scoring / detection-mapper / accident-context / masking（不確実なら広め）/ fallback-hazards（ダブル空）/ prompt生成。
- **Integration**: `/api/hunter/analyze`・`/api/hunter/session`、認証、所有者検証、巨大画像、非画像MIME、AI/RPC/Storage失敗、**レート制限超過時の429＋Retry-After（B6）**。
- **Security**（Phase 1+）: RLS、他ユーザー写真/セッション拒否、署名URL期限切れ、公開URL不使用、service_role使用時のアプリ層認可。
- **E2E**: 保存なし通常フロー、事故0件フロー、AI空検出フロー、マスク確認キャンセル、モバイルタップ精度。
- **Accessibility**: ファイル選択・地図ピン・写真タップ・(将来)クイズ・結果画面のキーボード/支援技術操作。

---

## 17. 前提（Assumptions）

- 初回は**家庭内/社内PoC**前提。学校・自治体利用は対象外。
- 子ども向け文言は「**気をつける練習**」に統一（安全判定にしない）。
- 写真保存は価値検証後の段階に下げる。保存する場合のみ同意・削除・保持期限・監査を必須化。

---

## 18. 既存コードの接続点（実装メモ）

- ベース: `app/safety-quest/safety-quest-client.tsx` `ArPhotoScreen`（L1940〜）＋ `app/api/safety-quest/private-practice/route.ts` → **新ルート `/app/safety-quest/hunter` へ移植**（巨大ファイルへの追加禁止）。
- Gemini: `lib/gemini-hazard.ts` `analyzeImagePipeline`/`getPipelinePromptByType` の `child` 分岐に `accidentContext` 注入点（options化）。
- スコアリング参考: `lib/hazard-game-matching.ts`（IoU照合）、`lib/safety-quest.ts`（`scoreSafetyQuestAttempt`）。
- 事故統計: `lib/traffic-accident-data.ts`（`getAccidentStatsRPC`/`getAccidentRiskLevel`/`getTimeSlotLabel`）→ §7.2 で分離。
- 画像保存参考（Phase 1）: `app/api/image/process/route.ts` の所有者スコープStorage（ただし**非公開＋署名URL**へ変更）。
- 画像前処理: `lib/image-utils.ts`（`compressImage`/`fileToBase64`）＋ canvas手動マスク。

---

## 19. 未決定・要決定事項

実装着手前に決めたい（v3で顕在化）:
- ~~**【要決定A】マスキング検出器**~~ → **決定済み**: MediaPipe Tasks Vision FaceDetector（動的import・遅延ロード）を第一候補。ネイティブ `FaceDetector` を機会的高速パスに、ナンバー/表札は手動補完、非対応時は手動必須。§6.6。
- ~~**【要決定B】クイズを Phase 0 に残すか**~~ → **決定済み**: **探索モードのみ**（クイズは Phase 2）。最短で動く探索PoCを優先。
- 1解析あたりのコスト実測と無料配布時の上限設計（レート制限閾値の具体値）。
- 第三者AI送信・越境移転の同意文言（B3）と、将来的に国内/オンデバイス推論へ寄せる必要性。
- 危険マップ地図ビュー・結果共有カードのUX（Phase 2）。
- 学校配布時の保護者/担任同意フロー・管理ビュー（Phase 3）。
