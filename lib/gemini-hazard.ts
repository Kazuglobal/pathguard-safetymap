import type {
  PromptType,
  VisionResult,
  ThinkResult,
  DetectionItem,
  DetectionCategory,
  BoundingBox,
  ContextualRisk,
  RiskSeverity,
} from "./hazard-game-types"
import { calculateSafetyScore } from "./hazard-game-scorer"
import type { PipelineAnalysisResult } from "./hazard-game-types"

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

import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "./gemini-util"

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

async function callGeminiVision(
  imageBase64OrDataUrl: string,
  prompt: string
): Promise<string> {
  if (!imageBase64OrDataUrl || imageBase64OrDataUrl.length < 50) {
    throw new Error("画像データが不足しています")
  }

  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiModel("gemini-3-pro-preview")

  let mimeType = "image/jpeg"
  let dataBase64 = imageBase64OrDataUrl
  if (imageBase64OrDataUrl.startsWith("data:")) {
    const match = imageBase64OrDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new Error("画像のdata URLが不正です")
    }
    mimeType = match[1]
    dataBase64 = match[2]
  }

  const parts: any[] = [
    { inline_data: { mime_type: mimeType, data: dataBase64 } },
    { text: prompt },
  ]

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
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
      { "label": "string", "description": "string", "count": 1, "confidence": 0.9, "coverage_ratio": 0.05, "positions": [{"x":0.1,"y":0.2,"width":0.1,"height":0.1}] }
    ],
    "hazards": [],
    "traffic": [],
    "obstructions": []
  },
  "think": {
    "contextual_risks": [
      { "description": "string", "severity": "high|medium|low", "related_detections": ["guardrail"] }
    ],
    "priority_improvements": ["string"],
    "latent_risks": ["string"],
    "child_perspective_risks": ["string"]
  },
  "educational_tips": ["string"]
}`

function getPipelinePromptByType(
  promptType: PromptType,
  userDetectedHazards?: string[]
): string {
  const userSuffix = userDetectedHazards?.length
    ? `\nユーザーが事前に発見した危険: ${userDetectedHazards.join(', ')}`
    : ''

  const commonSchema = `
以下のJSON形式で出力してください。説明文や前置きは不要。
${PIPELINE_JSON_SCHEMA}

共通要件:
- vision.safety_equipment: ガードレール(guardrail)、横断歩道(crosswalk)、信号機(traffic_light)、歩道(sidewalk)、カーブミラー(curve_mirror)、ガードパイプ(guard_pipe)などを検出。存在するものだけ含める。
- vision.hazards: 工事現場、壊れたフェンス、ブロック塀のひび、老朽化建物、落下物リスクなど。
- vision.traffic: 車両(car)、トラック(truck)、バイク(motorcycle)、自転車(bicycle)など。
- vision.obstructions: 雑草の繁茂、放置自転車、不法投棄物、視界を遮る看板など。
- 各カテゴリのアイテム: label(英語キーワード), description(日本語), count(個数), confidence(0-1), coverage_ratio(画像面積に対する割合0-1), positions(正規化bbox配列、不明なら空配列)
- think.contextual_risks: 視覚的兆候から推測される潜在的・複合的リスク。severity は "high"/"medium"/"low"。
- think.priority_improvements: 優先的に改善すべき項目。
- think.latent_risks: 時間経過や天候変化で顕在化するリスク。
- think.child_perspective_risks: 子どもの目線で気づきにくい危険。
- educational_tips: 具体的で実践的な安全アドバイスを日本語で3つ以上。
${userSuffix}
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
各カテゴリ5-8件程度を詳細に検出してください。
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
各カテゴリ2-4件程度を検出してください。
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
各カテゴリ3-5件程度を検出してください。
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

export async function analyzeImagePipeline(
  imageBase64OrDataUrl: string,
  userDetectedHazards?: string[],
  promptType: PromptType = "default"
): Promise<PipelineAnalysisResult> {
  const startTime = Date.now()

  const prompt = getPipelinePromptByType(promptType, userDetectedHazards)
  const textResponse = await callGeminiVision(imageBase64OrDataUrl, prompt)
  const parsed = extractFirstJson(textResponse)
  const { vision, think, educationalTips } = parseGeminiPipelineResponse(parsed)

  const visionWithTiming: VisionResult = {
    ...vision,
    inferenceTimeMs: Date.now() - startTime,
  }

  const score = calculateSafetyScore(visionWithTiming, think)

  return {
    vision: visionWithTiming,
    think,
    score,
    educationalTips,
    analysisTimestamp: new Date().toISOString(),
  }
}

// ===========================================================
// Legacy: 旧 API 互換関数（既存コンポーネント向け）
// ===========================================================

function getPromptByType(
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
