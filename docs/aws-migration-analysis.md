# AWS 移管アーキテクチャ提案 — pathguard-safetymap（通学路安全マップ）

最終更新: 2026-06-26 / 対象ブランチ: `claude/aws-migration-analysis-uza0an`

本書は、現行の **Vercel + Supabase + マルチAI API** 構成を AWS に移管する場合の
2つのアーキテクチャ案を示す。

- **案A「おすすめ（現実解 / ハイブリッド）」** … 移行コストとリスクを抑えつつ、機微データ（子ども・通学路）に効く部分だけ AWS に寄せる。
- **案B「理想（フルAWS / クラウドネイティブ）」** … 認証・DB・配信・AI を AWS に統合し、データ主権と統合運用を最大化する。

---

## 0. 現状アーキテクチャ（出発点）

| レイヤー | 現状サービス | 該当コード |
|---|---|---|
| ホスティング / 実行 | Vercel（Next.js 16, App Router, Serverless + Edge, Cron） | `app/`, `vercel.json` |
| DB / 認証 / ストレージ | Supabase（Postgres + PostGIS, Auth, Storage, Edge Functions/Deno, RLS） | `supabase/`, `lib/supabase-*.ts` |
| 画像分析(VLM) | Anthropic Claude（Supabase Edge `analyze-hazard`）／ Google Gemini Vision | `supabase/functions/analyze-hazard/`, `lib/gemini-hazard.ts`, `lib/vlm-analysis.ts` |
| 画像生成 | Gemini `gemini-3.1-flash-image`（浸水/津波シミュレーション） | `app/api/hazard/image/`, `lib/gemini-image.ts` |
| 地図 | Mapbox（経路/等時線/Matrix/Geocode）＋ Google 3D Tiles / Cesium / World Labs | `app/api/mapbox/*`, `app/3d-route-poc/` |
| キャッシュ / レート制限 | Upstash Redis | `lib/upstash-rate-limiter.ts` |
| 通知 | web-push（VAPID） | `lib/web-push.ts`, `app/api/push/*` |
| 監視 | Sentry | `sentry.*.config.ts` |

```mermaid
flowchart LR
  U[利用者/保護者] --> V[Vercel: Next.js 16]
  V -->|Auth/DB/Storage| SB[(Supabase\nPostgres+PostGIS / Auth / Storage)]
  V -->|VLM| ANT[Anthropic Claude]
  V -->|Vision/画像生成| GEM[Google Gemini]
  V -->|地図| MB[Mapbox / Google 3D Tiles]
  V -->|レート制限| UP[Upstash Redis]
  V -->|Push| WP[web-push VAPID]
  V -->|監視| SEN[Sentry]
  SB -->|Edge Fn analyze-hazard| ANT
```

---

## 案A：おすすめ（現実解 / ハイブリッド）

> 方針: **「動いているもの（認証・DB・ホスティング）は触らない」。**
> AWS化の旨味が大きい “画像分析・画像保管・バッチ処理” だけを Bedrock / S3 / EventBridge に切り出す。

```mermaid
flowchart LR
  U[利用者] --> V[Vercel: Next.js 16<br/>SSR/API Routes]

  subgraph KEEP[据え置き]
    SB[(Supabase<br/>Postgres+PostGIS / Auth / RLS)]
    MB[Mapbox / Google 3D Tiles]
    SEN[Sentry]
  end

  subgraph AWS[AWS へ切り出し]
    direction TB
    APIGW[API Gateway] --> L1[Lambda: hazard-analyze]
    L1 --> BR[Amazon Bedrock<br/>Claude 3.5 Vision]
    S3[(S3: 画像/シミュレーション)] --> CF[CloudFront]
    EB[EventBridge Scheduler] --> L2[Lambda: cron jobs]
    L1 --> DDB[(DynamoDB:<br/>レート制限/分析キャッシュ)]
    CW[CloudWatch + コスト配分タグ]
  end

  V -->|認証/データ| SB
  V -->|地図| MB
  V -->|画像分析| APIGW
  V -->|画像配信/保管| CF
  L1 --> S3
  L2 -->|集計書き戻し| SB
```

### 移管対象と移管先（案A）

| 機能 | 現状 | 案Aでの移管先 | 理由 |
|---|---|---|---|
| **VLM ハザード判定** | Claude / Gemini Vision | **Bedrock 上の Claude（Vision）** | 既存プロンプト資産（15カテゴリ, `vlm-analysis.ts`）をほぼ流用。IAM/VPCで通信が閉じる |
| 画像保管 | Supabase Storage | **S3 + CloudFront**（署名URL） | 画像増加時のコスト/CDNで有利。Storageと並行運用可 |
| 画像分析の実行基盤 | Supabase Edge(Deno) | **Lambda + API Gateway** | Bedrock 呼び出し・大量バッチを非同期化 |
| Cron | Vercel Cron | **EventBridge Scheduler → Lambda** | cron式そのまま移植、切り出しやすい |
| レート制限/分析キャッシュ | Upstash Redis | **DynamoDB（TTL）** or 据え置き | サーバレスでアイドル課金ほぼゼロ |
| 認証 / DB / ホスティング / 地図 | Supabase / Vercel / Mapbox | **据え置き** | 移行リスク最大・旨味最小。当面そのまま |

### 画像分析の流れ（案A）

```mermaid
sequenceDiagram
  participant App as Next.js (Vercel)
  participant GW as API Gateway
  participant L as Lambda
  participant DDB as DynamoDB(cache)
  participant BR as Bedrock(Claude Vision)
  participant S3 as S3

  App->>GW: 画像URL + コンテキスト (IAM署名)
  GW->>L: invoke
  L->>DDB: 署名キャッシュ照合
  alt キャッシュヒット
    DDB-->>L: 既存結果
  else 未分析
    L->>S3: 画像取得
    L->>BR: Vision 推論(15カテゴリ)
    BR-->>L: ハザードJSON
    L->>DDB: 結果保存(TTL)
  end
  L-->>App: 構造化ハザード結果
```

### メリット / デメリット（案A）

**メリット**
- 移行は **画像系のみ** に閉じ、認証・DB・UIに手を入れないため**短期間・低リスク**。
- 機微データ（子どもの通学路画像）の推論が **IAM / VPC / PrivateLink** で閉域化 → 自治体・教育委員会導入時の監査に有利。
- AI APIキー（`ANTHROPIC_API_KEY` / `GEMINI_API_KEY`）の分散を **IAMロールに集約**。
- CloudWatch + コスト配分タグで**画像分析コストを正確に可視化**（現状の自前 `api-usage-logger` を補完）。
- いつでも撤退・差し戻し可能（Strangler パターン）。

**デメリット**
- AWS と Vercel/Supabase の**2系統運用**になり、認証境界（Vercel→API Gateway の IAM 署名）の設計が必要。
- 画像生成（Gemini固有）は当面残すため、AI系がマルチベンダーのまま。
- Bedrock の Claude Vision モデルが**東京リージョンで利用可能か**の事前確認が必須。

---

## 案B：理想（フルAWS / クラウドネイティブ）

> 方針: **認証・DB・配信・AI・通知・監視を AWS に統合**。
> データ主権・統合運用・スケール時コスト最適化を最大化する“あるべき姿”。

```mermaid
flowchart TB
  U[利用者] --> CF[CloudFront + WAF]
  CF --> AMP[Amplify Hosting / OpenNext<br/>Next.js SSR on Lambda]
  CF --> S3W[(S3: 静的アセット)]

  AMP -->|認証| COG[Cognito User Pools]
  AMP -->|API| APIGW[API Gateway]

  subgraph DATA[データ層]
    AUR[(Aurora PostgreSQL<br/>+ PostGIS)]
    S3I[(S3: 画像/生成物)]
    REDIS[(ElastiCache / Valkey)]
  end

  subgraph AI[AI 層 - Bedrock]
    BRC[Claude Vision: ハザード判定]
    NOVA[Nova Canvas / SDXL: 災害画像生成]
  end

  APIGW --> LMB[Lambda 群<br/>hazard / routes / push / cron]
  LMB --> AUR
  LMB --> S3I
  LMB --> REDIS
  LMB --> BRC
  LMB --> NOVA
  EB[EventBridge Scheduler] --> LMB
  LMB -->|Push| SNS[SNS / Pinpoint]
  ALL[X-Ray + CloudWatch] -.観測.- LMB
  GEO[Location Service<br/>or Mapbox併用] --- AMP
```

### 移管対象と移管先（案B）

| 機能 | 現状 | 案Bでの移管先 |
|---|---|---|
| ホスティング(SSR/ISR) | Vercel | **Amplify Hosting** または **OpenNext + CloudFront/Lambda** |
| API / Edge | Vercel Functions | **API Gateway + Lambda**（必要箇所のみ Lambda@Edge / CloudFront Functions） |
| 認証 | Supabase Auth | **Cognito User Pools**（JWT, ソーシャルログイン） |
| DB | Supabase Postgres+PostGIS | **Aurora PostgreSQL（PostGIS）** — RLS/RPCを再構築 |
| ストレージ | Supabase Storage | **S3 + CloudFront**（署名URL / OAC） |
| VLM 画像分析 | Claude / Gemini | **Bedrock: Claude Vision** |
| 画像生成 | Gemini flash-image | **Bedrock: Nova Canvas / Stability SDXL**（要 画質PoC） |
| キャッシュ/レート制限 | Upstash | **ElastiCache（Redis/Valkey）** |
| Cron | Vercel Cron | **EventBridge Scheduler → Lambda** |
| 通知 | web-push | **Lambda から web-push 送信**（or Pinpoint/SNS でモバイル拡張） |
| 監視 | Sentry | **CloudWatch + X-Ray**（Sentry併用も可） |
| 地図 | Mapbox / Google | **Amazon Location Service**（or Mapbox併用） |

### メリット / デメリット（案B）

**メリット**
- 認証・DB・ストレージ・AI・通知・監視が **1つの IAM / 請求 / 監査** に統合。
- **国内リージョン完結・VPC内処理**でデータ主権を最大化 → 公共調達・自治体導入で強い差別化。
- 大規模トラフィック時、Aurora 予約 / Savings Plans / Compute Savings で**コストが読める**。
- Bedrock で **Claude / Nova / Llama** をコード固定のまま切替え、品質・コスト最適化が容易。

**デメリット**
- **開発体験の大幅低下**: Vercel の `push→自動デプロイ`、Supabase の即席 Auth/RLS/Storage を失い、IaC（CDK/Terraform）と運用一式を自前で抱える。
- **Auth 移行が最大の地雷**: Supabase Auth → Cognito は UIフロー（`/login` `/register` `/reset-password`）・JWT・RLS結合・**既存ユーザーのパスワードハッシュ移行**まで波及。ほぼ作り直し。
- **PostGIS / RPC 依存**: ヒートマップ系 `SECURITY DEFINER` RPC・RLSポリシー群（`supabase/migrations/` 多数）を Aurora で再構築・再検証。
- 画像生成の**画質劣化リスク**（Gemini固有挙動の代替）。
- RDS/ElastiCache/NAT など**アイドルでも固定費**が発生し、小規模では割高。

---

## 案A / 案B 比較サマリ

| 観点 | 案A（おすすめ / ハイブリッド） | 案B（理想 / フルAWS） |
|---|---|---|
| 移行期間 | 数週間 | 数ヶ月 |
| 移行リスク | 低（画像系に限定） | 高（Auth/DB/配信を作り直し） |
| データ主権・コンプラ | 画像分析は閉域化（十分効く） | 最大（全データ国内・VPC完結） |
| 開発体験 | ほぼ維持（Vercel/Supabase継続） | 大幅低下（IaC/運用内製化） |
| 固定費 | 低（サーバレス中心） | 中〜高（RDS/ElastiCache/NAT） |
| 撤退容易性 | 高（Strangler） | 低（後戻り困難） |
| 向いている段階 | 現在〜自治体PoC | 全国展開・公共調達フェーズ |

---

## 推奨ロードマップ（案A → 案B への段階移行）

```mermaid
flowchart LR
  P1[Phase1<br/>画像分析を Bedrock 化<br/>analyze-hazard 差替] --> P2[Phase2<br/>S3+CloudFront 画像保管<br/>Cron を EventBridge 化]
  P2 --> P3[Phase3<br/>ホスティングを OpenNext/Amplify へ]
  P3 --> P4[Phase4<br/>DB→Aurora / Auth→Cognito<br/>※公共調達要件が固まってから]
```

1. **Phase 1（最優先・最小リスク）**: `supabase/functions/analyze-hazard` の呼び先を **Bedrock(Claude Vision)** に差し替え。認証・DB・UIはそのまま。
2. **Phase 2**: 画像保管を **S3 + CloudFront**、Cron を **EventBridge + Lambda** に切り出し。
3. **Phase 3**: ホスティングを **OpenNext / Amplify** に移し、Vercel依存を解消。
4. **Phase 4（要件が固まってから）**: **Aurora + Cognito** へ。Auth 移行は本書最大の難所のため、自治体の閉域要件が確定してから着手。

> **結論**: いきなり案B（フルAWS）は規模に対して過剰。
> **案A を採用し、最大のインパクトである「画像分析(VLM)の Bedrock 化」から着手**するのが、
> コスト・リスク・データ主権のバランスが最も良い。案B は全国展開・公共調達フェーズの到達目標として据える。

---

## 7. コスト試算

> ⚠️ 価格は東京リージョン(ap-northeast-1)・2026年時点の概算。為替・モデル改定で変動するため
> 採用判断前に AWS Pricing Calculator で再見積もりすること。ここでは**構造（固定費 vs 従量）の違い**を掴むことを目的とする。

### 前提シナリオ

| | パイロット規模 | 市区展開規模 |
|---|---|---|
| MAU | 1,000 | 50,000 |
| 画像分析(VLM)回数/月 | 5,000 | 200,000 |
| 画像生成/月 | 500 | 10,000 |
| 画像保管 | 20 GB | 500 GB |
| API/ページ配信 | 〜50万req | 〜2,000万req |

### 7-1. 単価で見る画像分析（最重要コストドライバ）

VLM 1回 ≒ 画像(高解像度1枚 ≒ 1,000〜1,600トークン) + プロンプト2〜3k + 出力1k と仮定。

| モデル | 入力単価 | 出力単価 | VLM 1回あたり概算 |
|---|---|---|---|
| 現状 Gemini Flash 系 | 最安帯 | 最安帯 | **約 $0.001〜0.003** |
| 現状/Bedrock **Claude Haiku** | 低 | 低 | **約 $0.003〜0.006** |
| Bedrock **Claude Sonnet(Vision)** | 中 | 中 | **約 $0.01〜0.02** |

**ポイント**: Bedrock 化は**単価が下がるわけではない**（むしろ Gemini Flash より上がりうる）。
Bedrock の価値は *単価* ではなく **データ主権・IAM統合・閉域化**。コスト最適化したいなら
Bedrock 内で **Haiku/Nova を既定**にし、難所だけ Sonnet にルーティングする。

→ 月間VLMコスト目安: パイロット(5k回) **$15〜100**、市区(200k回) **$600〜4,000**（モデル選択で約7倍の幅）。

### 7-2. 月額ランニングコスト比較（インフラ部分・AI従量を除く）

| 項目 | 現状 (Vercel+Supabase) | 案A (ハイブリッド) | 案B (フルAWS) |
|---|---|---|---|
| ホスティング | Vercel Pro **$20〜** | Vercel継続 **$20〜** | Amplify/Lambda+CloudFront **$5〜30** |
| DB | Supabase Pro **$25** | Supabase継続 **$25** | Aurora Svls v2(最小0.5ACU) **$45〜** + I/O |
| 認証 | Supabase込み | Supabase込み | Cognito（5万MAUまで概ね無料枠〜**$0〜** ） |
| ストレージ/CDN | Supabase込み | S3+CloudFront **$3〜15** | S3+CloudFront **$3〜15** |
| キャッシュ | Upstash **$0〜10** | DynamoDB **$1〜5** | ElastiCache **$12〜** |
| NATゲートウェイ | 不要 | 不要(VPCエンドポイント) | **$32〜** + 転送量 |
| 監視 | Sentry **$0〜26** | Sentry継続 | CloudWatch **$5〜** (+Sentry任意) |
| **固定費の最小ライン** | **約 $45〜70/月** | **約 $50〜80/月** | **約 $130〜180/月**（アイドルでも発生） |

### 7-3. 規模別 総額イメージ（インフラ＋AI従量の合算・概算）

| | 現状 | 案A | 案B |
|---|---|---|---|
| **パイロット(MAU 1k)** | **約 $60〜170/月** | **約 $70〜180/月** | **約 $150〜300/月** |
| **市区展開(MAU 50k)** | **約 $700〜5,000/月** | **約 $650〜4,500/月** | **約 $900〜5,500/月** |

### 7-4. コスト構造から見た結論

1. **小規模ほど現状(Vercel+Supabase)が安い**。案B は Aurora/ElastiCache/NAT の**固定費下限(~$130/月)**が効き、トラフィックが小さいと割高。
2. **案A の追加コストは小さい**（+$5〜15/月程度）。VLM単価は据え置き〜微増だが、**閉域化・IAM統合という非コスト価値**が得られる“安い保険”。
3. **コスト削減目的なら AWS 移管は動機にならない**。効く順は (a) **Bedrock 内のモデル選択（Haiku/Nova 既定＋Sonnet ルーティング）**、(b) **分析結果のキャッシュ（同一画像の再分析回避：`prompt_signature` を既に保持）**、(c) **画像の事前リサイズ**でトークン削減。
4. **規模が大きくなるほど案A/案Bが逆転**しうる（Vercel/Supabaseの従量が跳ね、Savings Plans / Aurora予約で読めるAWSが有利化）。損益分岐は概ね **MAU 数万〜・VLM 月10万回超**が目安。
5. **案B を正当化するのはコストではなく要件**（公共調達の国内完結・閉域・監査）。要件が無いうちは案A で十分。

> **コスト面の総括**: 「安くしたい」なら移管しない or 案Aの最小構成＋モデル最適化。
> 「データ主権が要る」なら案A（安い保険）。「全国・公共調達」フェーズで初めて案Bの固定費が正当化される。
