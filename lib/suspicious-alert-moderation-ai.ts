// =============================================
// 不審者アラート AI一次審査（LLM/Vision 実審査）
// 設計書: docs/plans/2026-06-28-suspicious-alert-map-visualization-plan.md §1.5
//
// lib/suspicious-alert-moderation.ts のヒューリスティック核が予約していた
// 「実際のLLM/画像ビジョン審査はこのverdictを置き換える拡張点」の実装。
//
// 安全原則（絶対に緩めない）:
// - 最終判定は「ヒューリスティックとAIの厳しい方」。AIの判定でヒューリスティック
//   より緩い status を出すことはない（自動公開の範囲を広げない）。
// - 画像付き投稿は自動公開しない。Vision審査は人間モデレーターへの補助情報
//   （何が写り込んでいるか）を ai_moderation_reason に付けるためのもの。
// - AI呼び出しの失敗・タイムアウト・応答破損はヒューリスティック判定へフォールバック。
// - AIが「低リスク」でも確信度が低い場合は needs_review 側に倒す。
// - 自動 rejected は出さない（誤検出で投稿者の報告を握り潰さない。却下は人間の判断）。
// =============================================

import { z } from "zod"

import { callGeminiVision } from "@/lib/gemini-hazard"
import { getSanitizedGeminiApiKey, getSanitizedGeminiVisionModel } from "@/lib/gemini-util"
import {
  moderateSuspiciousAlert,
  type ModerationStatus,
  type ModerationVerdict,
} from "@/lib/suspicious-alert-moderation"

export interface AiModerationInput {
  text?: string | null
  hasImage?: boolean
  /** 添付画像のdata URL群（サーバ側でストレージから取得できたもののみ）。 */
  imageDataUrls?: readonly string[]
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

/** テキスト審査のタイムアウト。超過時はヒューリスティックへフォールバック。 */
const TEXT_MODERATION_TIMEOUT_MS = 15_000
/** 画像1枚あたりのVision審査タイムアウト。 */
const IMAGE_MODERATION_TIMEOUT_MS = 25_000
/** Vision審査にかける画像の上限枚数（コスト・レイテンシの有界化）。 */
const MAX_VISION_IMAGES = 3
/** AIが「低リスク」でもこの確信度未満なら needs_review に倒す。 */
const LOW_RISK_MIN_CONFIDENCE = 0.4

// ---- テキスト審査 ----

const textVerdictSchema = z.object({
  risk: z.enum(["low", "medium", "high"]),
  categories: z.array(z.string()).default([]),
  reason: z.string(),
  confidence: z.number().min(0).max(1).default(0.5),
})

type TextVerdict = z.infer<typeof textVerdictSchema>

/** Gemini構造化出力スキーマ（型名は大文字のGemini Schema形式）。 */
const TEXT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    risk: { type: "STRING", enum: ["low", "medium", "high"] },
    categories: { type: "ARRAY", items: { type: "STRING" } },
    reason: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
  required: ["risk", "reason", "confidence"],
} as const

function buildTextModerationPrompt(text: string): string {
  return `あなたは子ども見守りアプリの「不審者情報」投稿を公開してよいか審査するモデレーター補助AIです。
以下の投稿テキストを審査し、JSONだけを出力してください。

【必ず検出するもの（riskをmedium以上にする）】
1. 特定の個人を識別しうる情報: 実名、住所・部屋番号、車のナンバー、勤務先・学校名と個人の組み合わせ、SNSアカウント名など。
2. 断定的な犯人扱い・中傷・侮辱。**皮肉・婉曲表現・伏せ字・当て字・「あの人」「例の」のような指示語による示唆も含む**。表現が間接的でも、特定の人物を貶める・晒す意図が読み取れるなら検出する。
3. 差別的表現（国籍・障害・容姿などへの偏見に基づくレッテル貼り）。
4. 脅迫・私的制裁の呼びかけ（「みんなで押しかけよう」「見つけたらただじゃおかない」等）。
5. 虚偽通報・いたずらを強く疑わせる内容。

【検出しないもの（正当な情報共有。riskはlowのまま）】
- 不審者の外見・行動の客観的な描写（例:「黒い服の男性に声をかけられた」「白い車がゆっくり並走してきた」）。
- 場所・時間帯・状況の共有。子どもへの注意喚起。
- 断定を避けた表現（「〜のような人がいた」「不審に感じた」）。

【riskの意味】
- low: 公開してよい（上記の問題なし）
- medium: 人間の確認が必要（疑わしい・文脈依存）
- high: 明確な問題がある

【confidenceの意味】
- あなたの判定自体の確信度(0〜1)。文が短い・曖昧で判定に自信が持てないときは低くする。

【reason】
- 人間のモデレーターが読む日本語1〜2文。検出した場合は「何が・なぜ問題か」を具体的に。問題がない場合は簡潔に。

投稿テキスト:
"""
${text}
"""`
}

/** Gemini へのテキストのみの generateContent 呼び出し（構造化JSON出力・低温度・タイムアウト付き）。 */
async function callGeminiTextJson(prompt: string): Promise<string> {
  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiVisionModel("gemini-2.5-flash")

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: TEXT_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(TEXT_MODERATION_TIMEOUT_MS),
    },
  )

  if (!res.ok) {
    throw new Error(`Gemini text moderation failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: { text?: unknown }) => typeof p?.text === "string")?.text
  if (!textPart || typeof textPart !== "string") {
    throw new Error("Gemini text moderation returned no text output")
  }
  return textPart
}

/** 応答テキストからJSONオブジェクトを取り出す（コードフェンス・前置き混入への保険）。 */
function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1))
    }
    throw new Error("no JSON object in response")
  }
}

/**
 * テキストのLLM審査。失敗（ネットワーク/タイムアウト/破損応答）は null を返し、
 * 呼び出し側でヒューリスティック判定へフォールバックさせる。
 */
async function moderateTextWithLlm(text: string): Promise<TextVerdict | null> {
  try {
    const raw = await callGeminiTextJson(buildTextModerationPrompt(text))
    const parsed = textVerdictSchema.safeParse(parseJsonLoose(raw))
    return parsed.success ? parsed.data : null
  } catch (error) {
    // 投稿本文はログに出さない（PII保護）。エラー種別のみ。
    console.error(
      "suspicious moderation text LLM failed:",
      error instanceof Error ? error.message : "unknown error",
    )
    return null
  }
}

// ---- 画像（Vision）審査 ----

const imageVerdictSchema = z.object({
  identifiableFaces: z.boolean(),
  readableLicensePlates: z.boolean(),
  readableNameOrAddress: z.boolean(),
  childrenVisible: z.boolean().default(false),
  otherRisks: z.array(z.string()).default([]),
  summary: z.string(),
})

type ImageVerdict = z.infer<typeof imageVerdictSchema>

const IMAGE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    identifiableFaces: { type: "BOOLEAN" },
    readableLicensePlates: { type: "BOOLEAN" },
    readableNameOrAddress: { type: "BOOLEAN" },
    childrenVisible: { type: "BOOLEAN" },
    otherRisks: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
  },
  required: [
    "identifiableFaces",
    "readableLicensePlates",
    "readableNameOrAddress",
    "childrenVisible",
    "summary",
  ],
} as const

const IMAGE_MODERATION_PROMPT = `あなたは子ども見守りアプリに投稿された「不審者情報」の添付写真を、公開前にプライバシー審査するAIです。
写真を検査し、JSONだけを出力してください。

- identifiableFaces: ぼかし・モザイクなしで個人を識別できる顔が写っているか（後ろ姿や判別不能な遠景はfalse）。
- readableLicensePlates: 判読可能な車・バイクのナンバープレートが写っているか。
- readableNameOrAddress: 表札・住所表示・建物名・学校名・店名など、場所や個人を特定できる文字が判読できるか。
- childrenVisible: 子どもの姿が写っているか（顔の識別可否によらず）。
- otherRisks: その他、公開に不適切な要素があれば日本語で列挙（なければ空配列）。
- summary: 人間のモデレーター向けの日本語1文（何が写っていて、公開時に何を確認すべきか）。

判断に迷う場合は「写っている」側（true）に倒してください。`

/** 単一画像のVision審査。失敗は null（呼び出し側で集約）。 */
async function moderateSingleImage(imageDataUrl: string): Promise<ImageVerdict | null> {
  try {
    const raw = await withTimeout(
      callGeminiVision(imageDataUrl, IMAGE_MODERATION_PROMPT, {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: IMAGE_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      }),
      IMAGE_MODERATION_TIMEOUT_MS,
    )
    const parsed = imageVerdictSchema.safeParse(parseJsonLoose(raw))
    return parsed.success ? parsed.data : null
  } catch (error) {
    console.error(
      "suspicious moderation image vision failed:",
      error instanceof Error ? error.message : "unknown error",
    )
    return null
  }
}

/** callGeminiVision は AbortSignal 非対応のため、Promise.race で応答待ちだけを打ち切る。 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

interface AggregatedImageFindings {
  identifiableFaces: boolean
  readableLicensePlates: boolean
  readableNameOrAddress: boolean
  childrenVisible: boolean
  otherRisks: string[]
  summaries: string[]
  /** 審査できた枚数 / 試行枚数 */
  checkedCount: number
  attemptedCount: number
}

/** 複数画像のVision審査を並列実行し、検出結果をOR集約する。全滅なら null。 */
async function moderateImagesWithVision(
  imageDataUrls: readonly string[],
): Promise<AggregatedImageFindings | null> {
  const targets = imageDataUrls.slice(0, MAX_VISION_IMAGES)
  if (targets.length === 0) return null

  const results = await Promise.all(targets.map((url) => moderateSingleImage(url)))
  const succeeded = results.filter((r): r is ImageVerdict => r !== null)
  if (succeeded.length === 0) return null

  return {
    identifiableFaces: succeeded.some((r) => r.identifiableFaces),
    readableLicensePlates: succeeded.some((r) => r.readableLicensePlates),
    readableNameOrAddress: succeeded.some((r) => r.readableNameOrAddress),
    childrenVisible: succeeded.some((r) => r.childrenVisible),
    otherRisks: succeeded.flatMap((r) => r.otherRisks),
    summaries: succeeded.map((r) => r.summary).filter((s) => s.trim().length > 0),
    checkedCount: succeeded.length,
    attemptedCount: targets.length,
  }
}

// ---- 判定の合成 ----

const STATUS_RANK: Record<ModerationStatus, number> = {
  approved: 0,
  needs_review: 1,
  rejected: 2,
}

/** 2つの判定のうち厳しい方を返す（自動公開の範囲を絶対に広げない）。 */
function stricterStatus(a: ModerationStatus, b: ModerationStatus): ModerationStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

function describeImageFindings(findings: AggregatedImageFindings): {
  detected: string[]
  hasPrivacyRisk: boolean
} {
  const detected: string[] = []
  if (findings.identifiableFaces) detected.push("識別可能な顔")
  if (findings.readableLicensePlates) detected.push("判読可能なナンバープレート")
  if (findings.readableNameOrAddress) detected.push("表札・住所等の判読可能な文字")
  if (findings.childrenVisible) detected.push("子どもの写り込み")
  detected.push(...findings.otherRisks.slice(0, 3))
  return { detected, hasPrivacyRisk: detected.length > 0 }
}

/** ai_moderation_reason は人間が読む1フィールドなので、長くなりすぎないよう丸める。 */
function joinReasons(parts: string[], maxLength = 400): string {
  const joined = parts.filter((p) => p.trim().length > 0).join(" / ")
  return joined.length > maxLength ? `${joined.slice(0, maxLength - 1)}…` : joined
}

/**
 * 不審者アラートのAI一次審査（LLM/Vision 実審査）。
 *
 * - まずヒューリスティック（moderateSuspiciousAlert）で下限の判定を作り、
 *   AI審査は判定を「厳しくする方向」にのみ作用する。
 * - APIキー未設定・AI失敗時はヒューリスティック判定をそのまま返す（後方互換）。
 * - 決して throw しない。
 */
export async function moderateSuspiciousAlertWithAi(
  input: AiModerationInput,
): Promise<ModerationVerdict> {
  const text = (input.text ?? "").trim()
  const hasImage = Boolean(input.hasImage)
  const heuristic = moderateSuspiciousAlert({ text, hasImage })

  // APIキー未設定（ローカル開発等）はヒューリスティックのみで動く。
  try {
    getSanitizedGeminiApiKey()
  } catch {
    return heuristic
  }

  try {
    const [textVerdict, imageFindings] = await Promise.all([
      text.length > 0 ? moderateTextWithLlm(text) : Promise.resolve(null),
      hasImage && input.imageDataUrls && input.imageDataUrls.length > 0
        ? moderateImagesWithVision(input.imageDataUrls)
        : Promise.resolve(null),
    ])

    let status = heuristic.status
    let score = heuristic.score
    const reasons: string[] = []

    // ヒューリスティックが検出済みの問題（電話番号・NGワード・画像添付）は理由として残す。
    if (heuristic.status !== "approved") {
      reasons.push(heuristic.reason)
    }

    // -- テキストAI審査の反映（厳しくする方向のみ） --
    if (textVerdict) {
      if (textVerdict.risk !== "low") {
        status = stricterStatus(status, "needs_review")
        score = Math.max(score, textVerdict.risk === "high" ? 0.9 : 0.7)
        reasons.push(`AIテキスト審査: ${textVerdict.reason}`)
      } else if (textVerdict.confidence < LOW_RISK_MIN_CONFIDENCE) {
        // 低リスク判定でも確信度が低いときは安全側（needs_review）に倒す。
        status = stricterStatus(status, "needs_review")
        score = Math.max(score, 0.5)
        reasons.push("AIテキスト審査: 判定の確信度が低いため内容確認に回します。")
      } else if (status === "approved") {
        reasons.push("AIテキスト審査で個人情報・中傷を検出せず、低リスクと判定しました。")
      }
    } else if (text.length > 0 && status === "approved") {
      // AI審査が実行できなかった場合はヒューリスティックの判定文言を維持。
      reasons.push(heuristic.reason)
    }

    // -- 画像Vision審査の反映（人間審査の補助情報。自動公開はしない） --
    if (hasImage && imageFindings) {
      const { detected, hasPrivacyRisk } = describeImageFindings(imageFindings)
      const coverageNote =
        imageFindings.checkedCount < imageFindings.attemptedCount
          ? `（${imageFindings.attemptedCount}枚中${imageFindings.checkedCount}枚を審査）`
          : ""
      if (hasPrivacyRisk) {
        score = Math.max(score, 0.85)
        reasons.push(`AI画像審査: ${detected.join("・")}を検出${coverageNote}。公開前にマスキングの確認が必要です。`)
      } else {
        reasons.push(
          `AI画像審査: 顔・ナンバー・表札等の写り込みは検出されませんでした${coverageNote}。公開前の最終確認をお願いします。`,
        )
      }
      if (imageFindings.summaries.length > 0) {
        reasons.push(imageFindings.summaries[0])
      }
    }

    const reason = joinReasons(reasons)
    return {
      status,
      reason: reason.length > 0 ? reason : heuristic.reason,
      score,
    }
  } catch (error) {
    // ここに来るのは想定外の例外のみ。安全側フォールバック。
    console.error(
      "suspicious moderation AI unexpected failure:",
      error instanceof Error ? error.message : "unknown error",
    )
    return heuristic
  }
}
