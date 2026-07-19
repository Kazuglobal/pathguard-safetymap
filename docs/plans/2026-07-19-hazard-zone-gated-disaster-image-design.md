# ハザードマップ連動 災害画像生成 設計書（浸水区域ゲート + 事故データ活用）

作成日: 2026-07-19 / ステータス: 設計（実装未着手）/ 敵対的レビュー実施済み（CONFIRMED 8件を本文へ反映。主な反映先 = §2.2 / §2.5 / §2.6 / §2.7 / §3.2 / §6.3）
関連実装: ルートハザード可視化（`supabase/migrations/20260307193000_add_route_hazard_visualization.sql`、`app/api/hazard/image/route.ts`、`lib/hazard-scenarios.ts`）、災害シミュレーション（`components/danger-report/danger-report-form.tsx`、`app/api/gemini/generate-image/route.ts`、`lib/disaster-image-prompt-fallbacks.ts`）、事故統計（`lib/traffic-accident-data.ts`、`lib/traffic-accident/server.ts`）

## 0. 目的と要約

本設計は2つの独立した機能追加を扱う。

1. **浸水区域ゲート**: 洪水・津波の画像生成を「ハザードマップ上の浸水想定区域内の地点」に限定する。現状はどの場所でも洪水（冠水）画像が生成でき、実際には浸水想定のない場所に浸水イメージが紐づくことでアプリの信頼性を毀損している。
2. **事故データ活用**: DBに保有済みの警察庁交通事故オープンデータ（`traffic_accidents` 約153万件・2018〜2024年）を画像生成のプロンプトに注入し、「その場所の実データに基づいた」教育画像を生成できるようにする。

### 本設計の安全原則（既存設計から継承。緩めない）

1. **サーバはクライアント申告を信頼しない**: 生成可否の判定・浸水深・リスクレベル・事故統計は、すべてサーバがDBから導出する（不審者アラート/AI承認設計の「verdict はサーバ生成」原則の踏襲）
2. **判定失敗時は生成拒否（fail-closed）**: ゾーン判定RPCの失敗・タイムアウト時に「とりあえず生成」しない
3. **「区域外＝安全」と断定しない**: 拒否メッセージ・UIは「浸水想定区域外」と「安全」を明確に区別する（safe-house guard の思想。`UNVERIFIED_SAFE_HOUSE_ADDITION_GUARD` = `lib/disaster-image-prompt-fallbacks.ts:17` と同系）
4. **実データにない数値・事実を描かない**: 事故データは取得した実数のみをプロンプトに使い、捏造・水増し・丸め以外の加工を禁止する（[画像生成プロンプトの設計原則]「写っているものだけラベル」の拡張）
5. **段階的ロールアウト + キルスイッチ**: 環境変数1つで off / log / enforce を切り替え、いつでも現行動作へ戻せる

## 1. 現状分析（2系統の画像生成と問題点）

リポジトリには独立した2つの災害画像生成系統がある。

| | System A: 写真編集型 | System B: ハザードマーカー型 |
|---|---|---|
| 入口 | 危険箇所レポートフォームのシチュエーション選択（`danger-report-form.tsx:1596-1623`） | 地図のルートハザードマーカー →「災害イメージを見る」（`hooks/use-route-hazard-markers.tsx:93-108` → `hazard-image-modal.tsx`） |
| 種別 | viz / earthquake / typhoon / **flood(冠水)** / fire（`lib/disaster-scenario-prompts.ts:488-497`） | **flood / tsunami**（`lib/types.ts:138`） |
| 生成方式 | アップ写真をGeminiで編集（+Canvas簡易加工 `danger-report-form.tsx:546-604`） | 写真なしのゼロからのシーン生成（`buildHazardImagePrompt` = `lib/hazard-scenarios.ts:140-167`） |
| API | `/api/gemini/generate-prompts` + `/api/gemini/generate-image` | `/api/hazard/image` |
| 位置ゲート | **なし**（座標は生成APIに一切渡らない） | マーカー出現は `hazard_zones` × 通学路の PostGIS 交差由来（`get_route_hazard_intersections`）だが、**画像API自体は座標を再検証しない** |
| モデル | `gemini-3.1-flash-lite-image` 固定（`lib/gemini-image.ts:19`） | 同左 |

問題点の整理:

- **P1（本丸）**: System A の冠水シミュレーションは、浸水想定と無関係な任意の地点・任意の写真で生成できる。解析実行（手動トリガー `manualAnalysisTriggered` = `danger-report-form.tsx:610`）のバッチは、Canvas 簡易 flood 変種（`:688-696`）と Gemini flood シミュ（`:754-808`、flood プロンプト適用は `:782`）を必ず含む。
- **P2**: System B の `/api/hazard/image` はクライアント送信の `hazardType / riskLevel / depthMin/Max / areaContext` を構造検証のみで信頼する（`app/api/hazard/image/route.ts:46-86`）。認証ユーザーなら任意の組合せをPOSTでき、実在ゾーンと無関係な「リスク5・浸水深10m」の画像を作れる。
- **P3**: `locationLabel` はクライアント任意文字列がそのままプロンプトへ入る（`route.ts:113-121` → `hazard-scenarios.ts:150`）。プロンプトインジェクション面。
- **P4**: 画像生成3ルートすべてに**サーバ側レート制限がない**（`lib/upstash-rate-limiter.ts` の適用先に画像生成なし。抑制はクライアントのデバウンスのみ）。
- **P5**: `hazard_zones` は判定基盤（PostGIS MultiPolygon + GiST、`20260307193000` SQL:3-21）が整備済みだが、**実データがリポジトリに同梱されておらず**投入は `scripts/import-hazard-zones.ts` 頼み。カバレッジ（どの地域を取り込んだか）の管理もない。
- **P6**: `traffic_accidents`（153万件・PostGIS GIST・`get_nearby_accident_stats` RPC <100ms）は統計パネル表示（`accident-stats-panel.tsx`）とレポートへのキャッシュ（`enrichReportWithAccidents` = `lib/traffic-accident-data.ts:254`）に使われているが、**画像生成には未活用**。

## 2. 機能1: 浸水区域ゲートの設計

### 2.1 判定方式の決定

**採用: `hazard_zones` ポリゴンへの point-in-polygon 判定（PostGIS）**。既存の GiST インデックス・RLS・インポート経路をそのまま使え、判定根拠がDB内で完結・再現可能。

検討して不採用にした代替案:

| 案 | 不採用理由 |
|---|---|
| GSI「重ねるハザードマップ」タイルのピクセル色判定 | 色凡例の変更に脆弱 / タイルサーバへのサーバサイド依存と利用規約リスク / アンチエイリアスで境界誤判定 / オフライン再現性なし |
| 標高・河川距離からのヒューリスティック推定 | 標高≠浸水想定。公的想定と食い違う独自判定は信頼性目的と矛盾 |
| Mapbox Tilequery（`lib/routing/tilequery.ts:563` `assessFloodRisk()` → `risks.flood`） | OSMの水域近接による簡易推定であり浸水想定区域ではない。ゲートの根拠に使わない |

### 2.2 新RPC: 地点のハザードゾーン判定

```sql
-- 新規マイグレーション（疑似SQL）
create or replace function public.get_hazard_zones_at_point(
  p_longitude double precision,
  p_latitude double precision,
  p_hazard_type text default null,        -- 'flood' | 'tsunami' | null(両方)
  p_tolerance_m double precision default 0 -- 境界許容誤差(m)。System B のマーカー再判定のみ >0 で使用(§2.5)
)
returns table (
  id uuid, hazard_type text, source_layer text, risk_level integer,
  depth_min_m numeric, depth_max_m numeric, area_context text
)
language sql stable security invoker set search_path = public
as $$
  select hz.id, hz.hazard_type, hz.source_layer, hz.risk_level,
         hz.depth_min_m, hz.depth_max_m, hz.area_context
  from public.hazard_zones hz
  where (p_hazard_type is null or hz.hazard_type = p_hazard_type)
    and p_longitude between 122 and 154 and p_latitude between 20 and 46  -- 日本域外は即空
    and (
      st_intersects(hz.geom, st_setsrid(st_makepoint(p_longitude, p_latitude), 4326))
      or (least(p_tolerance_m, 50) > 0 and st_dwithin(
            hz.geom::geography,
            st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
            least(p_tolerance_m, 50)))   -- 上限50mにクランプ(過大な許容誤差の悪用防止)
    )
  order by hz.risk_level desc, hz.depth_max_m desc nulls last;
$$;
revoke all on function public.get_hazard_zones_at_point from public;
grant execute on function public.get_hazard_zones_at_point(double precision, double precision, text, double precision) to authenticated;
```

- 複数ゾーンが重なる場合の代表ゾーンは**先頭行**（risk_level 最大 → depth_max 最大）。タイブレークはこの2キーで決定論的にする。
- `get_route_hazard_intersections`（既存）と同じ security invoker + authenticated grant。`hazard_zones` の SELECT RLS は authenticated 全許可済み（`20260307193000` SQL:25-30）なのでクライアントからも直接呼べる（UI活性制御用）。サーバ側の最終判定は API ルートが `supabaseAdmin` 経由で再実行する（クライアント判定はUX最適化にすぎず、信頼しない）。

### 2.3 判定結果の4値と共有モジュール

判定は boolean ではなく4値で扱う（原則3のため「区域外」と「データ未整備」を区別する）。

```typescript
// 新規 lib/hazard-zone-gate.ts（純関数核 + サーバ用クエリラッパ）
export type HazardGateVerdict =
  | { kind: "inside"; zone: HazardZoneHit }      // 区域内 → 生成可。zone がプロンプトの唯一の情報源
  | { kind: "outside" }                          // カバレッジ内だがゾーン外 → 生成不可
  | { kind: "no_coverage" }                      // データ未整備地域 → 生成不可（メッセージが異なる）
  | { kind: "unavailable" }                      // RPC失敗・タイムアウト → 生成不可（fail-closed）

export interface HazardZoneHit {
  hazardType: "flood" | "tsunami"
  riskLevel: number                // 1-5
  depthMinMeters: number | null
  depthMaxMeters: number | null
  areaContext: HazardAreaContext
  sourceLayer: string              // 出典表記に使用
}
```

- `resolveHazardGate(zones, coverages, point, hazardType)` を純関数として実装し、ユニットテストで境界を固定する。
- RPC呼び出しには**タイムアウト（3秒）**を設け、超過は `unavailable`。

### 2.4 カバレッジ管理テーブル

```sql
create table if not exists public.hazard_zone_coverage (
  id uuid primary key default gen_random_uuid(),
  hazard_type text not null check (hazard_type in ('flood', 'tsunami')),
  region_label text not null,                 -- 例 '青森県'
  source text not null,                       -- 例 '国土数値情報 A31-12（想定最大規模）'
  source_layer text not null,
  coverage_geom geometry(MultiPolygon, 4326) not null,  -- 取り込み範囲（初期実装は取り込みfeature群のenvelope union）
  imported_features integer not null,
  imported_at timestamptz not null default now(),
  unique (hazard_type, region_label, source_layer)
);
create index if not exists hazard_zone_coverage_geom_gist on public.hazard_zone_coverage using gist (coverage_geom);
alter table public.hazard_zone_coverage enable row level security;
create policy "hazard_zone_coverage_select_authenticated" on public.hazard_zone_coverage
  for select to authenticated using (true);
```

- 判定フロー: ゾーンHitなし → 座標が `coverage_geom` に含まれるか → 含まれる=`outside` / 含まれない=`no_coverage`。
- `scripts/import-hazard-zones.ts` を拡張し、インポート完了時に coverage 行を upsert する（`--region "青森県" --source "国土数値情報 A31-12"` 引数を追加）。envelope union は近似であり、県境付近で `no_coverage` が `outside` に化ける可能性は既知の制約として許容（将来は行政界ポリゴンへ置換可能な設計にする）。

### 2.5 System B（`/api/hazard/image`）のサーバ側再検証（P2/P3の修正）

リクエストを「クライアントがハザード属性を申告する」形から「**座標だけ渡してサーバが導出する**」形へ変更する。

```
旧: { hazardType, riskLevel, depthMinMeters, depthMaxMeters, areaContext, scenarioKey, locationLabel }
新: { hazardType, longitude, latitude, scenarioKey }
```

サーバ処理（`app/api/hazard/image/route.ts` 改修）:

1. 認証（既存） → **レート制限追加**（§6.3）
2. `HAZARD_ZONE_GATE_MODE` が `off` の場合のみ旧動作（後方互換の移行期間用）
3. `supabaseAdmin.rpc("get_hazard_zones_at_point", { lon, lat, hazardType, toleranceM: 30 })` → `resolveHazardGate`
4. `inside` 以外は **422** `{ error, reason: "outside" | "no_coverage" | "unavailable" }`（reason別メッセージは§2.8）
5. `riskLevel / depth / areaContext` は**ゾーン行から導出**（クライアント値は受け取らない。送られてきても無視）
6. `scenarioKey` は導出した `areaContext` に対する `getHazardScenarioOptions` 検証（既存ロジック流用）
7. `locationLabel` はリクエストから廃止し、サーバが導出 `areaContext` から現行クライアントと**同一書式**の `` `${area_label} in Japan` ``（`map-container.tsx:957` と同じ）を決定的に組み立てる（P3のプロンプトインジェクション面を閉じつつ、プロンプト文字列＝`prompt_signature` を変えない）
8. 以降のキャッシュ・生成・保存は既存のまま。**レビュー指摘の反映**: `prompt_signature` は md5(プロンプト全文)（`route.ts:20-22`）であり書式を変えると既存キャッシュが全ミスして再生成スパイクになる。手順7の「書式維持」を仕様とすることで既存 `hazard_image_cache` エントリを引き続きヒットさせる

クライアント（`map-container.tsx:937-977` `handleGenerateHazardImage`）は `activeHazardMarker.coordinates` を送るだけに簡素化。マーカー自体がゾーン交差由来のため、正常系のUX変化はゼロ。

**境界許容誤差（レビュー指摘の反映）**: マーカー座標はゾーン**境界上**の点（`st_closestpoint` = `20260307193000` SQL:134）であり、§2.9 のジオメトリ簡略化（~5m）や座標の浮動小数往復により厳密な点包含判定から外れうる。System B の再判定は `p_tolerance_m = 30` で呼び、正当なマーカーが 422 になる誤拒否を防ぐ。System A（ユーザーが任意選択した地点）は `0`＝厳密判定。

### 2.6 System A（レポートフォーム冠水シミュ）のゲート（P1の修正）

**前提の明確化（レビュー指摘①の反映）**: System A の「冠水」は実装上、**水深15〜20cm・足首〜すね丈の浅い道路冠水（内水）表現に固定**されている（フォールバック = `lib/disaster-image-prompt-fallbacks.ts:26-27`「Do NOT show deep water, submerged cars」、LLM生成指示 = `lib/gemini-prompts.ts:179`）。これは A31（河川氾濫＝外水）/ A40（津波）の浸水想定とは物理現象が異なり、浅い内水冠水自体は想定区域外の低地でも起こりうる。それでも本設計は**製品判断として「冠水シミュは洪水ハザードゾーン内に限定」する**: 冠水画像が特定地点に紐づいて公開される以上、「公的な浸水想定のある場所」に限定することが本機能の信頼性要件（ユーザー要望そのもの）だからである。この判断で失われる正当なユースケース（区域外の内水冠水）は、**内水浸水想定データ（GSI「重ねるハザードマップ」内水レイヤー / 自治体公表データ）を `hazard_zones` に `hazard_type='flood', source_layer='naisui'` として追加取り込みする**ことで回復する（Phase 0 の対象データに含めてよい。ゲートはゾーン和集合で判定するため設計変更不要）。

ゲート対象の境界（自己矛盾を残さないための定義）: ゲートの単位は **situation**（「冠水シミュ画像を生成するか」）であり、プロンプト文中の水表現ではない。

- **ゲートする**: `situation === 'flood'` の全生成経路 — ①解析バッチ内の Gemini flood シミュ（`danger-report-form.tsx:754-808`、flood プロンプト適用 `:782`） ②Canvas簡易 flood オーバーレイ（`simulateVariant('flood')` `:561-568`、バッチ `:688-696`） ③`regenerateSituation` の flood（`:836-941`） ④一括生成の flood
- **ゲートしない**: 他 situation・11種対象者別プロンプトに**付随する**雨天・水たまり・側溝の表現（例: `lib/disaster-scenario-prompts.ts:283` は水たまりレベルの上限を自ら課している）。これらは冠水シミュ画像の生成ではなく写真解説の一部。earthquake / typhoon / fire も対象外
- 津波は System A に存在しない（situation に tsunami はない）ため、System A のゲートは flood のみ

実装:

**API側（強制層。レビュー指摘②の反映）**: 単に任意フィールドを追加するだけでは、既存の呼び出し（自動バッチ step5 `:714-723` / step6 `:759-764`、`regenerateSituation` `:906-912`）が situation を送らないため**サーバは flood 生成を識別できず、強制がクライアント任せになる**。よって:

- `/api/gemini/generate-image` は enforce モードで **`situation` を必須化**する（`viz | earthquake | typhoon | flood | fire | accident | custom` のいずれか。欠落は400）。全呼び出し箇所（上記3経路 + `app/tools/image-gen/page.tsx`）を**同一フェーズで改修**して situation を送る
- `situation === 'flood'` → 座標必須（無ければ400）→ ゲート判定 → `inside` 以外は 422。他の situation は座標不要
- **浸水系キーワード検査（Phase 3 に含める。レビュー指摘②による前倒し）**: `situation !== 'flood'` のリクエストで prompt に浸水系キーワード（`浸水 / 洪水 / 津波 / flood / tsunami / inundation` の狭いリスト。「水たまり」等の日常語は含めない）が含まれる場合は 422。situation 偽装による洪水プロンプト送信の主経路を塞ぐ。誤検知はゲートログ（§8）で監視し、リストはコード定数で管理する
- 残存リスク（明記）: キーワードに該当しない婉曲表現での洪水的画像は完全には防げない。本ゲートの目的は「通常UIから信頼性を損なう画像が作られない」ことであり、敵対的利用はレート制限＋認証＋ゲートログで監視する

**generate-prompts 側（レビュー指摘③の反映）**: 座標が渡され flood ゾーン外なら、レスポンスの `simulationPrompts.flood` を `null` にする（クライアントに flood 生成の材料を渡さない）。この変更は**クライアント型の変更を伴う**: 現行の型は非null string（`lib/gemini-prompts.ts:81-87`、受け側 `danger-report-form.tsx:650, 879`）であり、null をそのままバッチへ流すと `FormData.append('prompt', null)` が文字列 `"null"` へ強制変換され、サーバ検証（`generate-image/route.ts:44,68`）を通過して**ゴミプロンプトで生成が走る**。よって同時に: ①型を `string | null` へ変更 ②バッチ・再生成は flood プロンプトが null なら flood 変種を組み立てずスキップ ③`generate-image` サーバ側に空文字・リテラル `"null"` プロンプトの拒否を追加（防御の重層化）

**UI側（体験層）**: 位置選択時（`selectedLocation` 確定時）にクライアントから `get_hazard_zones_at_point` を1回呼び、結果を state に保持。

- `inside`: シチュエーションボタン「冠水」を通常表示。位置バッジ「🌊 洪水浸水想定区域内（想定最大浸水深 {depthLabel}）」を表示（信頼性の裏付けを見せる）
- `outside` / `no_coverage` / `unavailable`: 「冠水」ボタンを disabled + 理由ツールチップ。バッチから flood 変種（Gemini・Canvas とも）を除外（4変種→3変種）
- クライアント判定はUX用。最終強制はAPI側の situation 必須化＋ゲート＋キーワード検査

### 2.7 プロンプトの真実性強化（区域内で生成する場合）

ゲートを通った生成に、ゾーンの実データで裏付けを与える。**ただし System A では画像内の水位表現を既存の安全上限（15〜20cm・深い水/水没車の描画禁止）のまま維持し、「想定浸水深の深さで描け」という指示はしない**（レビュー指摘①(c)の反映: 想定深3〜5mのゾーンでそのまま描かせると、既存プロンプトのハードキャップおよび「深い洪水・恐怖演出を描かない」子ども向け安全原則と正面衝突する。安全原則の方を優先する）。

- System A flood: プロンプトへ注入するのは「この地点は公的な洪水浸水想定区域内である」という事実の言及と「水位表現は既存の控えめな上限を維持する」の再確認のみ。**想定浸水深の数値はUI側で伝える** — バッジ（§2.6）と生成画像のキャプション「この地点の想定最大浸水深: {depth}m（出典: {source}）※画像は表現を抑えたイメージです」。`FALLBACK_SIMULATION_PROMPTS.flood`（`lib/disaster-image-prompt-fallbacks.ts:21-30`）の15-20cm上限は**変更しない**
- System B: 従来どおり depth をプロンプトに使用（写真編集ではないゼロから生成の教育イラストで、浸水深の描写を前提に設計済み = `buildHazardImagePrompt`）。変更はサーバ導出化（§2.5）のみ
- UI表示: 生成画像の添付キャプションに「想定最大浸水深◯m（出典: 国土数値情報 / 重ねるハザードマップ）」を必ず併記。**画像内への焼き込みはしない**（既存の「画像内テキストは大きく・短く」原則と、教育画像への長文禁止ルールを維持）

### 2.8 メッセージング設計（原則3の実装）

| verdict | UI文言（例） |
|---|---|
| inside | 「洪水浸水想定区域内（想定浸水深 0.5〜3.0m）」バッジ |
| outside | 「この地点は洪水・津波の浸水想定区域外のため、浸水シミュレーション画像は生成できません。※区域外であることは安全を保証するものではありません」 |
| no_coverage | 「この地域のハザードマップデータは準備中のため、浸水シミュレーションはまだ利用できません」 |
| unavailable | 「浸水想定の確認ができないため、いまは生成できません。時間をおいてお試しください」 |

「区域外＝安全ではない」の注記は必須（省略しない）。文言は `lib/hazard-zone-gate.ts` に一元化し、コンポーネントごとのローカル文言を作らない（danger-level-presentation 一元化と同じ規律）。

### 2.9 ゾーンデータ整備計画（P5の解消。ゲートの前提条件）

**ゲートは deny-by-default なので、データ未整備のまま enforce にすると浸水系生成が全域で止まる。Phase 0a/0b のデータ整備が機能リリースの前提**。全国投入完了（Phase 0b）を enforce 進行の既定条件とするが、coverage 機構（§2.4）により部分投入状態でも未投入地域は「準備中」表示で整合的に運用できる（投入遅延時の安全網）。

- 出典:
  - 洪水: 国土数値情報 **A31（洪水浸水想定区域・想定最大規模L2）**。GSIタイル `01_flood_l2_shinsuishin_data`（`HAZARD_TILE_CONFIG` = `lib/hazard-scenarios.ts:7-20`）と同系の公的データ
  - 津波: 国土数値情報 **A40（津波浸水想定）**
  - 内水（任意・§2.6のカバレッジ回復用）: GSI「重ねるハザードマップ」内水レイヤー相当の自治体公表データを `hazard_type='flood', source_layer='naisui'` で追加取り込み可
  - 表示タイルと判定データの出典を揃えることで「見えている色」と「生成可否」の食い違いを防ぐ
- 変換: shp → GeoJSON（ogr2ogr）→ 既存 `scripts/import-hazard-zones.ts`（coverage 対応版）で投入
- 浸水深ランク → `risk_level` / `depth_*` の対応表（インポート時に決定論的に変換。judgment をコードに埋めない）:

| 浸水深ランク（A31/A40の区分） | depth_min_m | depth_max_m | risk_level |
|---|---|---|---|
| 0.5m未満 | 0 | 0.5 | 1 |
| 0.5〜3.0m | 0.5 | 3.0 | 2 |
| 3.0〜5.0m | 3.0 | 5.0 | 3 |
| 5.0〜10.0m | 5.0 | 10.0 | 4 |
| 10.0m以上（10〜20m / 20m〜含む） | 10.0 | null | 5 |

- **対象範囲は全国**（2026-07-19 ユーザー要件で青森県限定案から変更）。ただし一括投入はせず**都道府県単位のバッチ投入**とする（A31/A40の配布単位も都道府県）:
  - 前処理パイプライン: ogr2ogr で shp→GeoJSON 化・不要属性除去 → `ST_SimplifyPreserveTopology`（許容誤差 ~5m）→ 浸水深ランク×市区町村単位の `ST_Union`（ディゾルブ）でフィーチャ数を圧縮 → `ST_Subdivide`（最大256頂点）で巨大ポリゴンを分割し、GiST の点包含判定を全国規模でも高速に保つ
  - **既存 import script は全国規模で破綻する**: `scripts/import-hazard-zones.ts` は `fs.readFile` + `JSON.parse` の全量読み（`:119-120`）であり、県単位の大きなGeoJSONでもNodeのメモリ/文字列上限に当たりうる。都道府県ファイルの逐次実行 + NDJSON（行区切りGeoJSON）ストリーミング対応へ拡張し、`source_layer + region` 単位の洗い替え（delete→insert）で再実行冪等にする
  - サイズ見積り: 想定最大規模L2の全国合計は簡略化・ディゾルブ後でも数百MB〜数GBオーダーになりうる。**パイロット1県（青森県）で実測して×47で外挿し、Supabase プランのディスク上限と照合してから全国展開**する。超過見込みなら許容誤差の引き上げ（5→10m）とランク統合で再圧縮（§10）
  - 判定は点包含なので5m簡略化の影響は境界近傍のみ（既知の制約として記録）
- 津波（A40）は沿岸都道府県のみ公表。**内陸県は「データ未整備」ではなく「津波浸水想定の対象外」**なので、coverage に `imported_features=0`・県全域の `coverage_geom` で登録し、判定を `no_coverage`（準備中）ではなく `outside`（区域外）に落とす。これで内陸県に「準備中」表記が恒久的に残る不正確さを避ける
- ライセンス: 国土数値情報の利用約款に従い、UI・キャプションに出典を明記（タイル側は「国土交通省 重ねるハザードマップ」表記済み = `use-hazard-tile-layers.ts:60`）

## 3. 機能2: 事故データ活用の設計

### 3.1 データの現状と制約（設計の前提）

- 実体は**交通事故のみ**（水難・防犯等の「事故」データは存在しない）。したがって事故データ活用の対象は交通系の画像生成に限定し、洪水・津波画像（System B）には使わない
- スキーマの正は `lib/database.types.ts:1411-1524`（`traffic_accidents` の CREATE TABLE マイグレーションはリポジトリ未収録）。集計は `get_nearby_accident_stats` RPC（半径検索 <100ms）だが、**このRPC定義もマイグレーション未収録（DB直デプロイ）**
- 年窓は 2018〜2024 にアンカー補正が必要（`lib/accident-stats-year-window.ts:1-3` + `adjustYearsForAccidentDataset`）
- `danger_reports.accident_stats / accident_risk_score` に投稿地点周辺の統計をキャッシュする経路が既にある（`enrichReportWithAccidents` = `lib/traffic-accident-data.ts:254`）

**リポジトリ衛生（本設計で同時に対応）**: `get_nearby_accident_stats` の現行定義を `pg_get_functiondef` でエクスポートし、スナップショットマイグレーションとして収録する（DB直デプロイ関数がコードレビュー外にある状態を解消。AI承認設計のレビューでも同種の指摘あり）。

### 3.2 サーバ側取得の原則

事故統計は**APIルートがサーバ側で取得する**（`fetchNearbyAccidentStats` = `lib/traffic-accident/server.ts:27` を流用。失敗時 null の graceful degrade 挙動も継承）。クライアントが統計JSONを送ってくる形式は採らない（改竄された「事故0件」「事故100件」を画像に焼くリスク。原則1）。

パラメータは表示系と完全に一致させる: **半径300m・直近5年**を共有定数 `ACCIDENT_IMAGE_CONTEXT_PARAMS` として `lib/accident-stats-year-window.ts` 隣に定義し、統計パネル（`accident-stats-panel.tsx`）と画像生成で同じ値を参照する。パネルの数字と画像内の数字が食い違うと信頼性を毀損するため、ローカル定数の新設を禁止する。

**年窓の一致（レビュー指摘④の反映）**: 「同じ値を渡す」だけでは一致しない。表示系 `getAccidentStatsRPC` は `adjustYearsForAccidentDataset` でデータセット末尾（2024）にアンカー補正した年数をRPCへ渡す（`lib/traffic-accident-data.ts:200,210-214`。2026年時点で 5→7 に変換）が、本設計が流用する `fetchNearbyAccidentStats` は生の `p_years` を渡しており（`lib/traffic-accident/server.ts:45-56`）、同一地点でも件数がずれる。本設計は `fetchNearbyAccidentStats` に同じ補正を適用する改修（補正ロジックの共有ヘルパー化）を含め、「両経路が同じ実効年数をRPCへ渡すこと」をユニットテストで固定する。

### 3.3 プロンプトコンテキストビルダー（純関数）

```typescript
// 新規 lib/accident-prompt-context.ts
export function buildAccidentPromptContext(stats: AccidentStats | null): string | null
```

- `stats` が null または `total_accidents === 0` → **null を返す**（何も注入しない。「事故ゼロ＝安全」を示唆する文言も生成しない。原則3/4）
- 注入ブロックの構成（実在フィールドのみ・上位項目のみ）:

```
[この地点の客観データ（半径300m・直近5年・警察庁交通事故統計オープンデータ）]
- 事故 {total}件（歩行者関与 {ped}件 / 子ども関与 {child}件 / 死亡事故 {fatal}件）
- 多い時間帯: {peak_time_slot} / 多い事故類型: {top_accident_type} / 多い天候: {top_weather}
[このデータの使い方]
- 上記データが示すリスク（例: 出会い頭・登下校時間帯）に対応する注意表現を優先する。
- データにない事故・件数・被害を描かない。数値を変えない。
- 事故の瞬間・負傷者・損壊車両・血は描かない（恐怖演出禁止の既存原則）。
- 「事故が少ない/多いから安全/危険」という断定文を画像に書かない。
```

- ユニットテストで固定する境界: 0件 / フィールド欠損 / 極端な大数（そのまま出す。四捨五入等の丸めのみ許可）/ ラベル未知値のスキップ

### 3.4 注入ポイント1: 既存シチュエーション生成の強化

`/api/gemini/generate-prompts` に座標が渡ってきた場合（§2.6 で追加済みのフィールドを共用）:

1. サーバが `fetchNearbyAccidentStats` を実行（失敗時 null → 注入なしで続行。生成自体は止めない — 事故データは enrichment でありゲートではない）
2. `buildAccidentPromptContext` の結果を **viz（ハザード可視化）と交通系プロンプト**の生成指示に付加
3. 効果の例: 出会い頭事故が多い地点では飛び出し注意の強調が上がる、登下校時間帯ピークなら朝の通学シーン設定になる、雨天事故が多ければ雨天スリップ表現の優先度が上がる — **強調の優先順位付けに使い、写真にない物体の描画には使わない**

### 3.5 注入ポイント2: 新シチュエーション「じこデータ」（事故統計可視化）

`defaultSituations`（`lib/disaster-scenario-prompts.ts:488-497`）に `accident`（名称例: 「じこデータ」/ 説明: 「実際の事故データにもとづく注意マップ」）を追加する。

- 生成内容: アップ写真の上に、実統計に裏付けられた注意ポイントをオーバーレイした教育画像。短い数値ラベル（例「5年間で12件」「あさ7-8時に多い」）は許可（既存の「画像内の日本語は大きく・短く・正確に」規則 = `disaster-scenario-prompts.ts:13-19` に適合）
- サーバ強制: `situation === 'accident'` のとき座標必須。統計取得が失敗（null）または0件の場合は **422**（数値なしで「事故マップ風」の画像を作らない。捏造防止の fail-closed。§2.6 の flood と同じ整理）
- UI: 統計パネルと同じフックの結果で活性制御。0件地点ではボタンを disabled + 「この地点周辺の事故統計データはありません」
- プロンプト本体は `lib/disaster-scenario-prompts.ts` に追加し、`COMMON_IMAGE_RULES`（顔・ナンバー匿名化等）を適用。禁止事項: 事故の瞬間・負傷描写・特定車両の描写・統計にない場所への矢印

### 3.6 スコープ外（明記）

- System B（洪水/津波画像）への交通事故統計の注入はしない（災害と交通事故の混在は教育的に誤解を招く）
- 学校サマリー・PDFの既存規律（写真・description禁止）は本設計で変更しない
- 全ユーザー横断の事故ホットスポット自動抽出（新規タイル/レイヤー生成）は別設計

## 4. アーキテクチャ / API 変更一覧

| ルート | 変更 |
|---|---|
| `POST /api/hazard/image` | リクエスト形状変更（§2.5）: 座標ベース化・サーバ導出・422応答・`locationLabel` 廃止・レート制限追加 |
| `POST /api/gemini/generate-prompts` | `longitude? / latitude?` 追加。flood 区域外で `simulationPrompts.flood = null`（型を `string \| null` 化しクライアントのスキップ処理とセットで変更。§2.6）。事故コンテキスト注入（§3.4）。レート制限追加 |
| `POST /api/gemini/generate-image` | **`situation` 必須化（enforce時）** + `longitude? / latitude?` 追加。`flood` / `accident` はゲート強制（422）。浸水系キーワード検査・空/`"null"` プロンプト拒否。全呼び出し箇所の改修を同一フェーズで実施。レート制限追加 |
| （新規モジュール） | `lib/hazard-zone-gate.ts`（4値判定・文言一元化）/ `lib/accident-prompt-context.ts`（純関数） |
| （クライアント） | `danger-report-form.tsx`: 位置選択時ゾーン判定・冠水/じこデータ活性制御・バッチから flood 除外分岐。`map-container.tsx`: 座標送信化 |
| （スクリプト） | `scripts/import-hazard-zones.ts`: coverage upsert 対応（`--region` `--source` 追加） |

後方互換: System B の旧リクエスト形式は `HAZARD_ZONE_GATE_MODE=off` の間のみ受理。クライアントとAPIは同一デプロイで切り替わるため、移行期間後に旧形式パースを削除する。`app/tools/image-gen/page.tsx`（自由入力ツール）は位置概念がなくレポートに紐づかないため本ゲートのスコープ外とするが、flood/fire等プリセット出力に「教育用の想像図であり実在地点の浸水想定ではありません」の注記を追加する。

## 5. DB / RLS 設計まとめ

新規マイグレーション1本（＋スナップショット1本）:

1. `get_hazard_zones_at_point` RPC（§2.2。security invoker / authenticated grant）
2. `hazard_zone_coverage` テーブル + GiST + SELECT RLS（§2.4。書き込みは service_role のみ＝ポリシー無し）
3. `image_generation_gate_log`（§8。運用上 append-only＝サービスコードは INSERT のみ。DB制約での強制はしない。service_role のみアクセス＝ポリシー無し）
4. （別ファイル）`get_nearby_accident_stats` の現行定義スナップショット（§3.1）

既存テーブルのスキーマ変更・RLS変更は**なし**（`hazard_zones` / `hazard_image_cache` / `traffic_accidents` / `danger_reports` すべて現状のまま）。

## 6. フェイルセーフ設計

### 6.1 キルスイッチ

`HAZARD_ZONE_GATE_MODE = off | log | enforce`（既定 `off`）。

- `off`: 現行動作（判定もログもしない）
- `log`: 判定してログに記録するが生成は許可（シャドー運用。区域外生成の実態と、enforce 時に何%の生成が拒否されるかを事前計測）
- `enforce`: 本稼働（区域外・未整備・判定不能は 422）

事故データ注入は独立変数 `ACCIDENT_IMAGE_CONTEXT_ENABLED = true | false`（既定 false）。ゲートと enrichment を同じスイッチに載せない（片方の障害でもう片方を殺さない）。

### 6.2 失敗モードの整理

| 失敗 | 挙動 |
|---|---|
| ゾーンRPC失敗/タイムアウト(3s) | `unavailable` → 浸水系のみ生成拒否（fail-closed）。他 situation は影響なし |
| 事故統計RPC失敗 | viz等への注入をスキップして生成続行（enrichmentは fail-open）。`accident` situation のみ 422（fail-closed。数値の捏造余地を残さない） |
| ゲートログ書き込み失敗 | 生成処理は止めない（ログはベストエフォート。console.error のみ） |
| Gemini生成失敗 | 既存挙動を変更しない |

### 6.3 レート制限（P4の修正）

既存の Upstash リミッタ（`lib/upstash-rate-limiter.ts`）を3ルートへ適用する。**既存エクスポートは `checkApiRateLimit`（60回/60秒 `:62`）と `checkGeminiRateLimit`（10回/60秒）のみで、画像生成向けの窓は存在しない**（内部 `checkLimit` `:36` は未エクスポート）。よって内部 `checkLimit` を流用した新エクスポート `checkImageGenerationRateLimit` を追加する。目安（環境変数で調整可能に）:

- `/api/gemini/generate-image`・`/api/hazard/image`: `checkImageGenerationRateLimit` = **10回 / 5分 / ユーザー**（画像生成は高コスト。正常UIのバッチ生成=最大4枚+リトライが1操作で収まる値）
- `/api/gemini/generate-prompts`: `checkApiRateLimit`（既存 60回/60秒）で足りる

Upstash 未設定環境では既存実装の挙動（スキップ）に従い、ゲート本体には影響させない。

## 7. 段階的ロールアウト計画

| Phase | モード | 内容 | 次へ進むゲート条件 |
|---|---|---|---|
| 0a | `off` | マイグレーション適用（RPC・coverage・gate_log・statsスナップショット）+ `lib/hazard-zone-gate.ts` 実装 + **パイロット1県（青森県）**で変換パイプライン検証・サイズ/性能実測 | パイロット県の代表地点（浸水区域内/外/県外）でRPC実測が期待通り。×47外挿サイズが Supabase ディスク上限内（超過なら圧縮パラメータ再調整） |
| 0b | `off` | **全都道府県のバッチ投入**（A31全国 + A40沿岸県 + 内陸県の津波対象外登録）・coverage登録 | 47都道府県の coverage 登録完了。都道府県ごとのサンプル地点検証で判定が期待通り。RPC レイテンシが全国データ量でも実用域（<50ms） |
| 1 | `log` | 全生成経路で判定をログ記録のみ。UI変更なし | 2週間 or 生成50件以上。ログ上の `no_coverage` 率が想定内（対象地域内でほぼ0%）で、`unavailable` 率 < 1% |
| 2 | `enforce`（System B） | `/api/hazard/image` のサーバ導出化・座標ベース化・レート制限 | マーカー経由の正常フローで拒否が発生しないこと（マーカー=ゾーン由来なので理論上0。発生したら座標精度バグ） |
| 3 | `enforce`（System A） | `situation` 必須化（全呼び出し箇所改修）+ 冠水ゲートのUI+API強制 + 浸水系キーワード検査 + `simulationPrompts.flood` null化とクライアントスキップ + 区域内事実のバッジ/キャプション表示 | 区域内地点での生成成功・区域外地点でのUI無効化+422 をE2Eで確認。キーワード検査の誤検知がログ上で許容内。ユーザー向けヘルプに区域外文言を掲載 |
| 4 | - | 事故データ活用（`ACCIDENT_IMAGE_CONTEXT_ENABLED=true` → 注入 → 新situation「じこデータ」） | 注入ありの生成画像サンプル監査で数値の捏造・改変ゼロ（§9 eval） |

## 8. 監視・監査設計

```sql
create table public.image_generation_gate_log (
  id uuid primary key default gen_random_uuid(),
  route text not null,                 -- 'hazard-image' | 'generate-image' | 'generate-prompts'
  mode text not null,                  -- 'log' | 'enforce'
  situation text,                      -- flood / accident / (System B は hazard_type)
  verdict text not null,               -- inside | outside | no_coverage | unavailable
  zone_id uuid,                        -- inside 時の代表ゾーン
  lat_rounded numeric(6,3),            -- 精度~100mに丸めて保存（位置プライバシー配慮）
  lng_rounded numeric(6,3),
  user_id uuid,
  latency_ms integer,
  created_at timestamptz not null default now()
);
```

- 週次で見る指標: verdict 分布（特に enforce 後の `outside` 拒否率）、`no_coverage` 率（データ整備の優先地域決定に使う）、`unavailable` 率（RPC健全性）、ルート別生成回数とレート制限429率
- 事故データ注入の監査: `accident` situation の生成結果をランダム10件/週で目視し、画像内の数値が統計と一致するか確認（AI承認設計のサンプル監査と同じ運用。自動照合は作らない）
- アラート: 直近24hの `unavailable` 率 > 20%（PostGIS/RPC障害の検知）

## 9. テスト計画

- **ユニット（vitest）**
  - `lib/hazard-zone-gate.test.ts`: 4値判定の全分岐（ゾーンHit / coverage内ゾーン外 / coverage外 / RPC null）、複数ゾーンのタイブレーク（risk_level→depth_max）、日本域外座標、文言マッピング
  - `lib/accident-prompt-context.test.ts`: 0件→null、欠損フィールドのスキップ、数値の非改変、禁止事項文言の包含
  - `lib/hazard-scenarios` 拡張分: 浸水深注入付き flood プロンプトが範囲制約文を含むこと
- **ルートテスト（既存の `tests/unit/app/api/*` パターン踏襲、Gemini/RPCモック）**
  - `hazard/image`: 区域外422 / クライアントが旧形式で riskLevel=5 を送ってもゾーン値(例:2)でプロンプトが組まれる（スプーフィング無効化の確認）/ `log` モードで生成が通りログが書かれる / レート制限429
  - `generate-image`: enforce時の `situation` 欠落→400 / `situation=flood` で座標欠落→400、区域外→422、`earthquake` は座標なしで200 / `situation=accident` で統計0件→422 / キーワード検査（`situation=earthquake` + prompt に「津波」→422、「水たまり」→200）/ 空・リテラル `"null"` プロンプト→400
  - `generate-prompts`: 区域外で `simulationPrompts.flood === null` / 統計RPC失敗でも200（注入なし）
  - クライアント（`danger-report-form` テスト拡張）: flood プロンプト null 時にバッチが flood 変種を組み立てないこと（`"null"` 文字列が FormData に載らないこと）
  - 年窓一致: `fetchNearbyAccidentStats` と `getAccidentStatsRPC` が同一の実効 `p_years` をRPCへ渡すこと（§3.2）
- **RPC characterization**: ローカルSupabaseにフィクスチャポリゴン（正方形1個）を投入し、内点・外点・境界点・型フィルタ・`p_tolerance_m`（境界外30m以内がHit、50m超クランプ）を実測して固定（`get_route_hazard_intersections` に既存テストがない穴も同時に塞ぐ）
- **E2E（Playwright、認証つき検証ハーネス流用)**: ①区域内地点を選択→冠水ボタン活性→生成成功＋浸水深バッジ表示 ②区域外地点→冠水ボタン非活性＋ツールチップ ③マーカー経由の System B 生成が引き続き成功
- **eval（Phase 4 ゲート条件）**: 統計注入ありで生成した画像サンプルに対し「画像内の数値ラベルが入力統計と一致するか」「統計にない事実の描画がないか」を人手チェックリストで判定。合格基準: 捏造0件

## 10. コスト・レイテンシ見積もり方針

- ゾーン判定RPC: GiST点包含で数ms。生成1回あたりRPC1回、位置選択1回あたりクライアント判定1回の追加。体感影響なし
- 事故統計RPC: 実測 <100ms（既存ガイド値）。生成前の1回のみ、失敗時スキップ
- モデルコスト: 増加なし（モデル・生成回数は不変。むしろ区域外拒否とレート制限で**生成回数は減る方向**）
- DBサイズ: **全国スコープ**のA31/A40は簡略化・ディゾルブ・Subdivide 後でも数百MB〜数GBオーダーになりうる（§2.9）。パイロット1県の実測×47の外挿で確定し、Supabase プランのディスク上限（Pro: 8GB〜）と照合してから全国投入する。超過見込み時の調整レバー: 簡略化許容誤差 5→10m / 浸水深ランク統合 / 低ランク（<0.5m）の間引きは**行わない**（判定の欠落＝信頼性毀損のため、圧縮は形状精度側でのみ行う）。Phase 0a 実測後に確定値を本書へ追記

## 11. 実装順序（参考。実装は別途承認後）

1. マイグレーション（RPC・coverage・gate_log）+ RPC characterization テスト
2. `lib/hazard-zone-gate.ts`（純関数核 + 文言）+ ユニットテスト
3. A31/A40 データ変換・投入（import script のストリーミング/冪等化拡張 → パイロット県で実測 = Phase 0a → 全都道府県バッチ投入 + 内陸県の津波対象外登録 = Phase 0b）
4. レート制限の3ルート適用（独立コミット。ゲートと分離）
5. `log` モード実装（3ルートへの判定+ログ差し込み）→ Phase 1 シャドー運用
6. System B サーバ導出化 + クライアント座標送信化 → Phase 2
7. System A 冠水ゲート（`situation` 必須化と全呼び出し箇所改修 / generate-prompts の flood null 化とクライアントスキップ / キーワード検査 / フォームUI）+ 区域内バッジ・キャプション → Phase 3
8. `get_nearby_accident_stats` スナップショット収録 + `lib/accident-prompt-context.ts` + 注入 → 新situation「じこデータ」 → Phase 4
