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

export type PromptType = "default" | "expert" | "child"

import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "./gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

function extractFirstJson(text: string): any {
  // Try code fences first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fence ? fence[1] : text
  // Heuristic: find first { ... } block
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const jsonSlice = candidate.slice(start, end + 1)
    try { return JSON.parse(jsonSlice) } catch {}
  }
  // Fallback: try parsing the whole string
  try { return JSON.parse(candidate) } catch {}
  throw new Error("Failed to parse JSON from Gemini response")
}

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

export async function analyzeImageForHazardsGemini(
  imageBase64OrDataUrl: string,
  userDetectedHazards?: string[],
  promptType: PromptType = "default"
): Promise<HazardAnalysisResult> {
  if (!imageBase64OrDataUrl || imageBase64OrDataUrl.length < 50) {
    throw new Error("画像データが不足しています")
  }

  const apiKey = getSanitizedGeminiApiKey()
  // Gemini 3 API (gemini-3-pro-preview) を使用して高度な推論を行う
  const model = getSanitizedGeminiModel("gemini-3-pro-preview")

  // Accept both raw base64 and data URL
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

  const prompt = getPromptByType(promptType, userDetectedHazards)

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

  const parsed = extractFirstJson(textPart)

  // Minimal validation/coercion
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
