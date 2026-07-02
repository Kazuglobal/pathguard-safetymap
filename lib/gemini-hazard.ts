import type {
  PromptType,
  VisionResult,
  ThinkResult,
  DetectionItem,
  DetectionCategory,
  BoundingBox,
  ContextualRisk,
  RiskSeverity,
  UserMarker,
  ComparisonResult,
  PipelineAnalysisResultWithComparison,
} from "./hazard-game-types"
import { calculateSafetyScore, calculateFinalScoreWithBonus } from "./hazard-game-scorer"
import { compareUserMarkersWithAI } from "./hazard-game-matching"

export type { PromptType }

// ---- Legacy types (backward compat) ----

type Hazard = {
  type: string
  description: string
  severity: number
  location: string
  confidence: number
  bbox?: { x: number; y: number; width: number; height: number }
}

export type HazardAnalysisResult = {
  hazards: Hazard[]
  overallSafety: number
  educationalTips: string[]
  score: number
}

import { getSanitizedGeminiApiKey, getSanitizedGeminiVisionModel } from "./gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

// ---- JSON 抽出 ----

function extractFirstJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fence ? fence[1] : text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const jsonSlice = candidate.slice(start, end + 1)
    try { return JSON.parse(jsonSlice) } catch {}
  }
  try { return JSON.parse(candidate) } catch {}
  throw new Error("Failed to parse JSON from Gemini response")
}

// ---- Gemini API 共通呼び出し ----

/** generateContent の generationConfig (呼び出し側ごとに必要な分だけ指定)。 */
export interface GeminiVisionGenerationConfig {
  /** 低いほど決定的・保守的(構造化検出向け)。未指定ならAPI既定値。 */
  readonly temperature?: number
  /** "application/json" を指定すると応答がJSONのみに強制される。 */
  readonly responseMimeType?: string
  /** Gemini Schema形式(type は "OBJECT"/"STRING" 等の大文字)。responseMimeTypeと併用。 */
  readonly responseSchema?: Record<string, unknown>
}

export async function callGeminiVision(
  imageBase64OrDataUrl: string,
  prompt: string,
  generationConfig?: GeminiVisionGenerationConfig
): Promise<string> {
  if (!imageBase64OrDataUrl || imageBase64OrDataUrl.length < 50) {
    throw new Error("画像データが不足しています")
  }

  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiVisionModel("gemini-2.5-flash")

  let mimeType = "image/jpeg"
  let dataBase64 = imageBase64OrDataUrl
  if (imageBase64OrDataUrl.startsWith("data:")) {
    // 正規表現の貪欲キャプチャ (.+) は数MBの data URL でスタックを使い切り
    // RangeError を投げるため、indexOf ベースで O(n) かつ非再帰にパースする。
    const commaIndex = imageBase64OrDataUrl.indexOf(",")
    const header = commaIndex >= 0 ? imageBase64OrDataUrl.slice(0, commaIndex) : ""
    const semicolonIndex = header.indexOf(";")
    if (commaIndex < 0 || semicolonIndex < 0 || !header.includes(";base64")) {
      throw new Error("画像のdata URLが不正です")
    }
    mimeType = header.slice("data:".length, semicolonIndex)
    dataBase64 = imageBase64OrDataUrl.slice(commaIndex + 1)
  }

  const parts: any[] = [
    { inline_data: { mime_type: mimeType, data: dataBase64 } },
    { text: prompt },
  ]

  const requestBody: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    ...(generationConfig && {
      generationConfig: {
        ...(generationConfig.temperature !== undefined && { temperature: generationConfig.temperature }),
        ...(generationConfig.responseMimeType && { responseMimeType: generationConfig.responseMimeType }),
        ...(generationConfig.responseSchema && { responseSchema: generationConfig.responseSchema }),
      },
    }),
  }

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini request failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
  if (!textPart || typeof textPart !== "string") {
    throw new Error("Gemini response did not contain text output")
  }

  return textPart
}

// ===========================================================
// パイプライン版: Vision + Think 構造化プロンプト
// ===========================================================

const PIPELINE_JSON_SCHEMA = `{
  "vision": {
    "safety_equipment": [
      { "label": "guardrail", "description": "道路左右に設置されたガードレール", "count": 2, "confidence": 0.92, "coverage_ratio": 0.15, "positions": [{"x":0.02,"y":0.55,"width":0.38,"height":0.08}, {"x":0.60,"y":0.52,"width":0.35,"height":0.09}] },
      { "label": "crosswalk", "description": "横断歩道の白線", "count": 1, "confidence": 0.88, "coverage_ratio": 0.10, "positions": [{"x":0.25,"y":0.70,"width":0.50,"height":0.15}] }
    ],
    "hazards": [
      { "label": "cracked_wall", "description": "ブロック塀の縦方向のひび割れ（地震時倒壊リスク）", "count": 1, "confidence": 0.85, "coverage_ratio": 0.08, "positions": [{"x":0.72,"y":0.25,"width":0.18,"height":0.40}] }
    ],
    "traffic": [
      { "label": "car", "description": "走行中の乗用車", "count": 1, "confidence": 0.95, "coverage_ratio": 0.12, "positions": [{"x":0.30,"y":0.40,"width":0.25,"height":0.20}] }
    ],
    "obstructions": [
      { "label": "overgrown_vegetation", "description": "歩道にはみ出した雑草", "count": 1, "confidence": 0.75, "coverage_ratio": 0.05, "positions": [{"x":0.85,"y":0.60,"width":0.12,"height":0.25}] }
    ]
  },
  "think": {
    "contextual_risks": [
      { "description": "ブロック塀のひび割れが進行しており、震度5以上で倒壊し歩行者を巻き込む可能性", "severity": "high", "related_detections": ["cracked_wall"] }
    ],
    "priority_improvements": ["ブロック塀の耐震補強または撤去・フェンス化"],
    "latent_risks": ["豪雨時に側溝が詰まり道路冠水の可能性"],
    "child_perspective_risks": ["ガードレールの隙間から車道に出てしまうリスク"]
  },
  "educational_tips": ["ひび割れたブロック塀の近くを歩かないようにしましょう", "横断歩道では左右を確認してから渡りましょう", "雑草で見通しが悪い場所では立ち止まって確認しましょう"]
}`

export function getPipelinePromptByType(
  promptType: PromptType,
  userMarkers?: readonly UserMarker[],
  accidentContext?: string
): string {
  const accidentSuffix = accidentContext && accidentContext.trim().length > 0
    ? `\n\n${accidentContext.trim()}`
    : ''
  const userSuffix = userMarkers?.length
    ? `\n\n【ユーザーマーキング情報】\nユーザーは以下の${userMarkers.length}箇所を事前に危険と判断しました:\n${userMarkers.map((m, i) =>
        `${i + 1}. カテゴリ: ${m.category}, ラベル: ${m.label}, 位置: (x:${m.x.toFixed(2)}, y:${m.y.toFixed(2)}, w:${m.width.toFixed(2)}, h:${m.height.toFixed(2)})`
      ).join('\n')}\nユーザーがマーキングした領域を注意深く確認し、その付近にある危険を正確にbboxで記述してください。\nまた、ユーザーが見逃した危険箇所も積極的に検出してください。\nユーザーのbboxに影響されず、AIとして独自に正確なbboxを算出すること。`
    : ''

  const commonSchema = `
以下のJSON形式で出力してください。説明文や前置きは不要。
${PIPELINE_JSON_SCHEMA}

共通要件:
- vision.safety_equipment: ガードレール(guardrail)、横断歩道(crosswalk)、信号機(traffic_light)、歩道(sidewalk)、カーブミラー(curve_mirror)、ガードパイプ(guard_pipe)などを検出。存在するものだけ含める。
- vision.hazards: 工事現場、壊れたフェンス、ブロック塀のひび、老朽化建物、落下物リスクなど。
- vision.traffic: 車両(car)、トラック(truck)、バイク(motorcycle)、自転車(bicycle)など。
- vision.obstructions: 雑草の繁茂、放置自転車、不法投棄物、視界を遮る看板など。

各カテゴリのアイテム必須フィールド:
- label: 英語キーワード (例: guardrail, broken_fence, car)
- description: 日本語での詳細説明（何がどこにあるか具体的に）
- count: 検出個数 (整数、実際に見える数)
- confidence: 検出信頼度 0.0-1.0
- coverage_ratio: 画像面積に対する割合 0.0-1.0
- positions: 【必須】正規化bbox配列。空配列[]は絶対に不可。

Bounding Box (positions) 記述ルール:
1. 全ての検出物に対してpositionsを必ず1つ以上記述すること。空配列[]は禁止。
2. countの値とpositions配列の要素数は必ず一致させること（count=3なら3つのbbox）。
3. x, y は物体の左上角の座標。width, height は物体のサイズ。全て0.00-1.00の正規化値（小数第2位まで）。画像左上が(0,0)、右下が(1,1)。
4. bboxは物体に密着（tight-fit）させること。余白を含めない。物体の輪郭ギリギリを囲む。
5. confidence >= 0.8 の検出物は特に精密なbboxを記述すること。物体の実際の形状・位置を正確に反映。
6. 物体が部分的に隠れている・画面端で切れている場合でも、可視部分全体を囲むbboxを記述。
7. 画像の座標系を正しく認識すること: 左=x小、右=x大、上=y小、下=y大。

よくある間違い（避けること）:
- NG: positions: [] （空配列は禁止）
- NG: count: 3, positions: [bbox1] （countとpositions数が不一致）
- NG: {"x":0.0,"y":0.0,"width":1.0,"height":1.0} （画像全体を囲むのは不正確）
- NG: 全ての検出物が同じ座標 （各物体の実際の位置を個別に特定すること）

Bounding Box 座標の具体例:
- 画像中央やや左の車: positions: [{"x":0.25,"y":0.40,"width":0.30,"height":0.22}]
- 画像下部の横断歩道: positions: [{"x":0.10,"y":0.72,"width":0.55,"height":0.18}]
- 画面右端で半分切れている看板: positions: [{"x":0.85,"y":0.08,"width":0.15,"height":0.20}]
- 道路の左右にガードレール2本: count: 2, positions: [{"x":0.02,"y":0.50,"width":0.15,"height":0.08}, {"x":0.80,"y":0.48,"width":0.18,"height":0.09}]

空間的位置の判断基準:
- 画像の左半分にあるもの: x < 0.5
- 画像の右半分にあるもの: x >= 0.5
- 画像の上半分にあるもの: y < 0.5
- 画像の下半分にあるもの: y >= 0.5
- 遠くの小さい物体: width, height は小さめ (0.03-0.15程度)
- 近くの大きい物体: width, height は大きめ (0.2-0.8程度)
- 物体同士が重なっている場合: それぞれ個別のbboxを記述

- think.contextual_risks: 視覚的兆候から推測される潜在的・複合的リスク。severity は "high"/"medium"/"low"。
- think.priority_improvements: 優先的に改善すべき項目。
- think.latent_risks: 時間経過や天候変化で顕在化するリスク。
- think.child_perspective_risks: 子どもの目線で気づきにくい危険。
- educational_tips: 具体的で実践的な安全アドバイスを日本語で3つ以上。

重要: 検出物がないカテゴリは空配列[]で構いません。ただし検出物がある場合、そのpositionsフィールドは必ず非空にすること。

出力前チェックリスト（必ず確認）:
1. 全てのアイテムのpositionsが空配列[]になっていないか → なっていればbboxを追加
2. countとpositions配列の要素数が一致しているか
3. bboxの座標が0.00-1.00の範囲内か
4. 各bboxが実際の物体の位置・サイズに対応しているか
${userSuffix}${accidentSuffix}
必ずJSONのみを出力。`

  switch (promptType) {
    case "expert":
      return `入力画像を都市防災・減災の専門家として詳細に分析してください。

分析観点:
1. 土砂災害: 斜面、擁壁、がけの老朽化、法面の角度
2. 水害: 低地形状、排水口・側溝の構造、雨水滞留
3. 建物倒壊・落下物: 老朽化建物、軒先・看板・外壁の落下リスク
4. 道路交通事故: 死角、横断歩道、ガードレール、車両接触ポイント
5. 防災設備: 消火栓、避難誘導灯、避難経路の障害物

トーン: 冷静で客観的な専門家レベルの詳細分析。住民・行政双方への提言を含む。
各カテゴリ5-8件程度を詳細に検出してください。全ての検出物に正確なbounding boxを付与すること。
${commonSchema}`

    case "child":
      return `入力画像を見て、小学生にもわかるように「まちのあぶないところ」を分析してください。

分析観点:
1. じしんのとき あぶないもの: たてもののひび、おちてきそうなもの
2. あめのとき みずがたまりやすいところ: みぞ、くぼんでいるばしょ
3. くるまにきをつけるばしょ: みえにくいかど、よこぎるばしょ
4. にげるときのみち: ひろいながれ、じゃまなもの

トーン: やさしい日本語。こわがらせず、前向きで楽しく学べるように。
label は英語キーワード（例: guardrail, crosswalk, traffic_light, sidewalk）を使い、description はやさしい日本語で記述（例：「たてもののひび」「みえにくいかど」）。
各カテゴリ2-4件程度を検出してください。全てのものに正確なbounding boxをつけること。
${commonSchema}`

    case "default":
    default:
      return `以下の日本の街路・歩道の写真を分析し、通学路の安全性を多角的に評価してください。

分析観点:
- 安全設備: ガードレール、横断歩道、信号機、歩道の有無と状態
- 危険要素: 工事現場、壊れたフェンス、老朽化構造物、落下物リスク
- 交通状況: 車両数と種類、速度環境、歩行者との接触リスク
- 障害物: 雑草、放置物、視界を遮るもの
- 潜在的リスク: 地震・台風・豪雨時に顕在化する危険、連鎖的な被害

トーン: バランスの取れた分析。表面的な危険だけでなく潜在的・複合的リスクも深く分析。
各カテゴリ3-5件程度を検出してください。全ての検出物に正確で密着したbounding boxを付与すること。
${commonSchema}`
  }
}

// ---- パイプライン レスポンスパーサー ----

export function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val)
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export function parseBbox(raw: any): BoundingBox {
  return {
    x: clampNum(raw?.x, 0, 1, 0),
    y: clampNum(raw?.y, 0, 1, 0),
    width: clampNum(raw?.width, 0, 1, 0),
    height: clampNum(raw?.height, 0, 1, 0),
  }
}

export function parseDetectionItems(
  rawItems: any[],
  category: DetectionCategory
): DetectionItem[] {
  if (!Array.isArray(rawItems)) return []
  const parseCount = (rawCount: unknown): number => {
    const n = Number(rawCount)
    if (!Number.isFinite(n)) return 1
    return Math.max(0, Math.round(n))
  }

  return rawItems.map((item: any) => ({
    category,
    label: String(item?.label ?? item?.type ?? "unknown"),
    description: String(item?.description ?? ""),
    count: parseCount(item?.count ?? 1),
    confidence: clampNum(item?.confidence, 0, 1, 0.5),
    coverageRatio: clampNum(item?.coverage_ratio, 0, 1, 0),
    positions: Array.isArray(item?.positions)
      ? item.positions.map(parseBbox)
      : [],
  }))
}

function parseRiskSeverity(val: unknown): RiskSeverity {
  const s = String(val ?? "").toLowerCase()
  if (s === "high" || s === "medium" || s === "low") return s
  return "medium"
}

export function parseContextualRisks(rawRisks: any[]): ContextualRisk[] {
  if (!Array.isArray(rawRisks)) return []
  return rawRisks.map((r: any) => ({
    description: String(r?.description ?? ""),
    severity: parseRiskSeverity(r?.severity),
    relatedDetections: Array.isArray(r?.related_detections)
      ? r.related_detections.map(String)
      : [],
  }))
}

export function parseGeminiPipelineResponse(raw: any): {
  vision: VisionResult
  think: ThinkResult
  educationalTips: string[]
} {
  const v = raw?.vision ?? {}
  const t = raw?.think ?? {}

  const vision: VisionResult = {
    safetyEquipment: parseDetectionItems(v.safety_equipment, "safety_equipment"),
    hazards: parseDetectionItems(v.hazards, "hazards"),
    traffic: parseDetectionItems(v.traffic, "traffic"),
    obstructions: parseDetectionItems(v.obstructions, "obstructions"),
    inferenceTimeMs: 0,
  }

  const think: ThinkResult = {
    contextualRisks: parseContextualRisks(t.contextual_risks),
    priorityImprovements: Array.isArray(t.priority_improvements)
      ? t.priority_improvements.map(String)
      : [],
    latentRisks: Array.isArray(t.latent_risks)
      ? t.latent_risks.map(String)
      : [],
    childPerspectiveRisks: Array.isArray(t.child_perspective_risks)
      ? t.child_perspective_risks.map(String)
      : [],
  }

  const educationalTips = Array.isArray(raw?.educational_tips)
    ? raw.educational_tips.map(String)
    : []

  return { vision, think, educationalTips }
}

// ---- パイプライン版メイン関数 ----

export interface AnalyzeImageOptions {
  readonly userMarkers?: readonly UserMarker[]
  readonly promptType?: PromptType
  /** その地点の事故傾向をプロンプトに注入する文字列 (空可) */
  readonly accidentContext?: string
  /** ログ/コスト計測の区別用 (例: "hunter-explore") */
  readonly purpose?: string
}

function normalizeAnalyzeArgs(
  optionsOrUserMarkers?: AnalyzeImageOptions | readonly UserMarker[],
  legacyPromptType?: PromptType
): { userMarkers?: readonly UserMarker[]; promptType: PromptType; accidentContext?: string } {
  if (Array.isArray(optionsOrUserMarkers)) {
    return { userMarkers: optionsOrUserMarkers, promptType: legacyPromptType ?? "default" }
  }
  const opts = (optionsOrUserMarkers ?? {}) as AnalyzeImageOptions
  return {
    userMarkers: opts.userMarkers,
    promptType: opts.promptType ?? legacyPromptType ?? "default",
    accidentContext: opts.accidentContext,
  }
}

/**
 * Vision→Think→Score パイプライン。
 * 後方互換: 旧 `(image, userMarkers[], promptType)` 形式と、新 `(image, options)` 形式の両方を受ける。
 */
export async function analyzeImagePipeline(
  imageBase64OrDataUrl: string,
  optionsOrUserMarkers?: AnalyzeImageOptions | readonly UserMarker[],
  legacyPromptType?: PromptType
): Promise<PipelineAnalysisResultWithComparison> {
  const startTime = Date.now()

  const { userMarkers, promptType, accidentContext } = normalizeAnalyzeArgs(
    optionsOrUserMarkers,
    legacyPromptType
  )
  const prompt = getPipelinePromptByType(promptType, userMarkers, accidentContext)
  const textResponse = await callGeminiVision(imageBase64OrDataUrl, prompt)
  const parsed = extractFirstJson(textResponse)
  const { vision, think, educationalTips } = parseGeminiPipelineResponse(parsed)

  const visionWithTiming: VisionResult = {
    ...vision,
    inferenceTimeMs: Date.now() - startTime,
  }

  const baseScore = calculateSafetyScore(visionWithTiming, think)

  let comparison: ComparisonResult | undefined
  if (userMarkers && userMarkers.length > 0) {
    const allDetections = [
      ...visionWithTiming.safetyEquipment,
      ...visionWithTiming.hazards,
      ...visionWithTiming.traffic,
      ...visionWithTiming.obstructions,
    ]
    comparison = compareUserMarkersWithAI(userMarkers, allDetections)
  }

  const finalScore = comparison
    ? calculateFinalScoreWithBonus(baseScore, comparison)
    : baseScore

  return {
    vision: visionWithTiming,
    think,
    score: finalScore,
    educationalTips,
    analysisTimestamp: new Date().toISOString(),
    comparison,
  }
}

// ===========================================================
// Legacy: 旧 API 互換関数（既存コンポーネント向け）
// ===========================================================

export function getPromptByType(
  promptType: PromptType,
  userDetectedHazards?: string[]
): string {
  const userHazardsSuffix = userDetectedHazards?.length
    ? `\n${userDetectedHazards.join(', ')}`
    : ''

  switch (promptType) {
    case "expert": {
      return `入力画像を詳細に分析し、都市空間に潜む災害・防災・減災リスク、交通事故リスクを可視化する高度なインフォグラフィックを生成してください。

▼目的
地域の防災・減災、道路安全対策としてリスクを多角的に理解できる図を作成する。

▼出力スタイル
・プロフェッショナルで見やすいインフォグラフィック
・白地ベース＋アクセントカラー（赤＝危険、黄色＝注意、青＝安全）
・統一されたアイコン、図形、ラベル
・視認性の高いレイアウト（左右または上下に情報整理）
・図解＋説明テキスト付き

▼分析する災害・リスク項目
1. **土砂災害の可能性**
　- 斜面、盛り土、擁壁、がけの老朽化
　- 法面の角度、ひび割れ、崩落リスク

2. **水害（浸水・内水氾濫）リスク**
　- 低地形状
　- 排水口・側溝の構造
　- 雨水滞留の可能性

3. **建物倒壊・落下物リスク**
　- 老朽化した建物
　- 軒先・看板・配管・外壁の落下リスク

4. **道路交通事故リスク**
　- 視界不良ポイント（死角）
　- 横断歩道の有無
　- ガードレール・歩道の不備
　- 車両の進行方向・危険接触ポイント
　- 子どもや高齢者が歩行時に危険な箇所

5. **防災設備の有無**
　- 消火器・消火栓・避難誘導灯
　- 避難経路のわかりやすさ／障害物

▼インフォグラフィック構成
A. 画像（入力写真）の上に
　- 危険箇所を赤のアウトラインでマーキング
　- 注意箇所は黄色、安全箇所は青
　- 各ポイントに番号＋アイコン付与

B. 右側または下部に「リスク解説ボックス」
　- ①土砂災害の可能性
　- ②浸水リスク
　- ③建物落下物リスク
　- ④交通事故の危険
　- ⑤防災設備情報

C. 最後に「推奨アクション」
　- 住民が取るべき行動
　- 行政・管理者が取るべき対策

▼トーン
・冷静で客観的
・専門家レベルの詳細分析
・読みやすく、子供や高齢者でも理解しやすい

以下のJSON形式で出力してください。説明文や前置きは不要。フィールドは厳密に一致させてください。
{
  "hazards": [
    { "type": "string", "description": "string", "severity": 1, "location": "string", "confidence": 0.0, "bbox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 } }
  ],
  "overallSafety": 1,
  "educationalTips": ["string"],
  "score": 0
}

要件:
- severity: 1(危険)〜5(安全)。confidence: 0〜1。
- overallSafety: 1(非常に危険)〜5(非常に安全)。
- educationalTips: 住民・行政が取るべき具体的な対策を日本語で3つ以上提案してください。
- score: 0〜100 (安全性が高いほど高得点)。
- 可能であれば各hazardに bbox を付与: 画像左上を(0,0)、右下を(1,1)とした正規化座標で、{x,y,width,height}。不明なら省略可。
${userHazardsSuffix}
必ずJSONのみを出力。`
    }

    case "child": {
      return `入力画像を見て、子どもにも分かるように"まちのあぶないところ"を楽しく学べるインフォグラフィックを作ってください。

▼目的
小学生でも理解できる防災・減災・交通安全の学習用ポスターを作る。

▼デザインスタイル
・明るくてやさしい色（パステルカラー）
・丸みのある図形、かわいいアイコン（キャラクター風でも可）
・難しい言葉は使わず"やさしい日本語"
・危険は「赤」、気をつける場所は「黄色」、安全は「青や緑」
・全体はイラスト教材のように親しみやすく

▼分析する内容
1. じしんのとき あぶないもの
　・たてものの ひび、かべ、でっぱり
　・おちてきそうな もの（かんばん、タイル）

2. あめのとき みずが たまりやすいところ
　・みぞ（どぶ）
　・たまりみずの のこり方
　・くぼんでいる ばしょ

3. くるまに きをつける ばしょ
　・みえにくい かど
　・よこぎるばしょ（おうだんほどう の 有無）
　・ほそい どうろ
　・スピードが 出やすい ばしょ

4. にげるときの みち
　・ひろい ながれ
　・じゃまなもの が ないか
　・ひなんできる ばしょ

▼インフォグラフィック構成
A. 入力画像の上に
　・あぶないところを 赤いまるで しめす
　・ちゅういが ひつようなところは 黄色
　・あんぜんなところは 青や緑
　・吹き出しでやさしい説明を書く（例：「ここはすべりやすいよ！」）

B. 右または下に「やさしい説明ボックス」
　・①じしんのときの あぶないところ
　・②あめの日の ちゅうい
　・③くるまに きをつけよう
　・④にげる ときの みち

C. 最後のまとめ
　・「みつけたあぶないところは まわりの大人に おしえよう！」
　・「あめの日やよるは とくに気をつけよう！」
　・イラストキャラが"いいね！"ポーズ

▼トーン
・こわがらせず、でも大事なことはしっかり伝える
・前向きで、やさしく、子どもの学びを助けるように
・読みやすく、1〜2年生でも理解できる言葉づかい

以下のJSON形式で出力してください。説明文や前置きは不要。フィールドは厳密に一致させてください。
{
  "hazards": [
    { "type": "string", "description": "string", "severity": 1, "location": "string", "confidence": 0.0, "bbox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 } }
  ],
  "overallSafety": 1,
  "educationalTips": ["string"],
  "score": 0
}

要件:
- type, description: やさしい日本語で記述してください（例：「たてものの ひび」「みえにくい かど」）
- severity: 1(あぶない)〜5(あんぜん)。confidence: 0〜1。
- overallSafety: 1(とてもあぶない)〜5(とてもあんぜん)。
- educationalTips: 子ども向けのやさしいアドバイスを日本語で3つ以上提案してください（例：「みつけたあぶないところは まわりの大人に おしえよう！」）。
- score: 0〜100 (安全性が高いほど高得点)。
- 可能であれば各hazardに bbox を付与: 画像左上を(0,0)、右下を(1,1)とした正規化座標で、{x,y,width,height}。不明なら省略可。
${userHazardsSuffix}
必ずJSONのみを出力。`
    }

    case "default":
    default: {
      return `以下の日本の街路・歩道の写真を分析し、JSONだけを出力してください。説明文や前置きは不要。フィールドは厳密に一致させてください。
{
  "hazards": [
    { "type": "string", "description": "string", "severity": 1, "location": "string", "confidence": 0.0, "bbox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 } }
  ],
  "overallSafety": 1,
  "educationalTips": ["string"],
  "score": 0
}

要件:
- モデル: Gemini 3 Pro (最新モデル) の高度な推論能力を活用し、表面的な危険だけでなく、**潜在的な危険**や**複合的なリスク**も深く分析してください。
- 想定ハザード: 地震・台風(強風)・豪雨(冠水)・火災・交通事故・防犯上の死角など、幅広い観点で分析してください。
- 各ハザードについて:
  - 視覚的な兆候だけでなく、その状況から予測される連鎖的な危険（例: ブロック塀が倒壊した場合の避難路遮断など）も含めて記述してください。
  - 3〜5件程度抽出してください。
- severity: 1(危険)〜5(安全)。confidence: 0〜1。
- overallSafety: 1(非常に危険)〜5(非常に安全)。
- educationalTips: 現場で実行可能な具体的かつ実践的な対策を日本語で簡潔に3つ以上提案してください。
- score: 0〜100 (安全性が高いほど高得点)。
- 可能であれば各hazardに bbox を付与: 画像左上を(0,0)、右下を(1,1)とした正規化座標で、{x,y,width,height}。不明なら省略可。
${userHazardsSuffix}
必ずJSONのみを出力。`
    }
  }
}

/** @deprecated Use analyzeImagePipeline instead */
export async function analyzeImageForHazardsGemini(
  imageBase64OrDataUrl: string,
  userDetectedHazards?: string[],
  promptType: PromptType = "default"
): Promise<HazardAnalysisResult> {
  const prompt = getPromptByType(promptType, userDetectedHazards)
  const textResponse = await callGeminiVision(imageBase64OrDataUrl, prompt)
  const parsed = extractFirstJson(textResponse)

  const hazards: Hazard[] = Array.isArray(parsed?.hazards) ? parsed.hazards.map((h: any) => ({
    type: String(h?.type ?? "unknown"),
    description: String(h?.description ?? ""),
    severity: Math.max(1, Math.min(5, Number(h?.severity ?? 3))),
    location: String(h?.location ?? ""),
    confidence: Math.max(0, Math.min(1, Number(h?.confidence ?? 0.5))),
    bbox: h?.bbox && typeof h.bbox === 'object'
      ? {
          x: Math.max(0, Math.min(1, Number(h.bbox.x ?? 0))),
          y: Math.max(0, Math.min(1, Number(h.bbox.y ?? 0))),
          width: Math.max(0, Math.min(1, Number(h.bbox.width ?? 0))),
          height: Math.max(0, Math.min(1, Number(h.bbox.height ?? 0))),
        }
      : undefined,
  })) : []

  const overallSafety = Math.max(1, Math.min(5, Number(parsed?.overallSafety ?? 3)))
  const educationalTips = Array.isArray(parsed?.educationalTips) ? parsed.educationalTips.map((t: any) => String(t)) : []
  const score = Math.max(0, Math.min(100, Number(parsed?.score ?? 0)))

  return { hazards, overallSafety, educationalTips, score }
}
