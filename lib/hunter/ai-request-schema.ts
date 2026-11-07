// =============================================
// きけんハンター 専用AI リクエスト設定 (Gemini generationConfig)
// 低温度+構造化出力(responseSchema)で、的外れな検出・JSON崩れを構造的に減らす。
// hunter-ai.ts の関心(プロンプト文面/オーケストレーション)から分離する。
// =============================================

import { KID_DANGER_KINDS } from "@/lib/hunter/kid-copy"
import type { GeminiVisionGenerationConfig } from "@/lib/gemini-hazard"

/**
 * AI に出させる座標の形式。
 * - "box2d": Gemini が学習で慣れた box_2d [ymin,xmin,ymax,xmax] と focus [y,x](0〜1000の整数)。既定。
 * - "region": 旧形式の {x,y,w,h}(0〜1)。比較・切り戻し用。
 * パーサ(ai-schema.ts)はどちらの形式も読むので、ここを切り替えるだけで戻せる。
 */
export type HunterCoordFormat = "box2d" | "region"
export const HUNTER_COORD_FORMAT: HunterCoordFormat = "box2d"

const regionSchema = {
  type: "OBJECT",
  properties: {
    x: { type: "NUMBER" },
    y: { type: "NUMBER" },
    w: { type: "NUMBER" },
    h: { type: "NUMBER" },
  },
  required: ["x", "y", "w", "h"],
}

/** box_2d / focus は整数の配列(長さは zod 側で確かめる。minItems には頼らない)。 */
const intArraySchema = { type: "ARRAY", items: { type: "INTEGER" } }

/** 座標の形式ごとの properties・生成順。 */
function coordFields(format: HunterCoordFormat): {
  properties: Record<string, unknown>
  keys: string[]
} {
  if (format === "region") return { properties: { region: regionSchema }, keys: ["region"] }
  return { properties: { box_2d: intArraySchema, focus: intArraySchema }, keys: ["box_2d", "focus"] }
}

const quizSchema = {
  type: "OBJECT",
  properties: {
    question: { type: "STRING" },
    choices: { type: "ARRAY", items: { type: "STRING" } },
    explanation: { type: "STRING" },
  },
  required: ["question", "choices", "explanation"],
}

function buildDangerPointSchema(format: HunterCoordFormat) {
  const coords = coordFields(format)
  return {
    type: "OBJECT",
    properties: {
      // 分析用の根拠フィールド(子ども表示なし)。答えより先に書かせる write-before-answer 用。
      evidence: { type: "STRING" },
      kind: { type: "STRING", enum: [...KID_DANGER_KINDS] },
      kidType: { type: "STRING" },
      ...coords.properties,
      severity: { type: "STRING", enum: ["high", "medium", "low"] },
      confidence: { type: "NUMBER" },
      whyDangerous: { type: "STRING" },
      safeAction: { type: "STRING" },
      accidentLink: { type: "STRING", nullable: true },
      quiz: quizSchema,
    },
    // focus は required に入れない(無ければ枠の中心で採点できる。拒否時の故障半径を小さくする)。
    required: ["kind", coords.keys[0], "severity", "confidence", "whyDangerous", "safeAction", "quiz"],
    // Gemini Schema拡張: 生成順を「根拠→分類→位置→確信度→文言」に固定(write-before-answer)。
    // evidence は required に入れない(API拒否=400→guide(ai_error)全滅の故障半径を最小化)。
    // propertyOrdering は properties のキーと完全に一致させる(ずれると 400 になる)。
    propertyOrdering: [
      "evidence",
      "kind",
      "kidType",
      ...coords.keys,
      "severity",
      "confidence",
      "whyDangerous",
      "safeAction",
      "accidentLink",
      "quiz",
    ],
  }
}

function buildSafePointSchema(format: HunterCoordFormat) {
  const region = format === "region" ? { region: regionSchema } : { box_2d: intArraySchema }
  return {
    type: "OBJECT",
    properties: {
      kind: { type: "STRING", enum: [...KID_DANGER_KINDS] },
      kidType: { type: "STRING" },
      ...region,
      whyGood: { type: "STRING" },
    },
  }
}

/** 専用ハンターAI応答のJSON Schema(Gemini responseSchema形式)。型・enumだけを縛り、文言の自由度は奪わない。 */
export function buildHunterResponseSchema(format: HunterCoordFormat = HUNTER_COORD_FORMAT) {
  return {
    type: "OBJECT",
    properties: {
      version: { type: "STRING" },
      imageUsable: { type: "BOOLEAN" },
      dangerPoints: { type: "ARRAY", items: buildDangerPointSchema(format) },
      safePoints: { type: "ARRAY", items: buildSafePointSchema(format) },
      noHazardFollow: { type: "STRING", nullable: true },
    },
    required: ["imageUsable", "dangerPoints"],
  } as const
}

export const HUNTER_RESPONSE_SCHEMA = buildHunterResponseSchema(HUNTER_COORD_FORMAT)

/**
 * 専用ハンターAI呼び出しの generationConfig。
 * - temperature を下げ、的外れな検出(物体=危険の誤判定)のばらつきを抑える。
 * - responseMimeType+responseSchema で構造化出力を強制し、JSON崩れ(parse_error)を構造的に減らす。
 * - 万一 API がこの設定を拒否しても、呼び出し側(hunter-ai.ts)は例外を guide モードへ吸収するため安全側に倒れる。
 */
/**
 * 1 コールの時間上限。初回 35 秒 + 再試行/再出力 20 秒 = 最悪 75 秒で必ず guide へ落ち、
 * 上流ハング時に子どもを無期限に待たせない(クライアント側の上限 95 秒より短い)。
 */
export const HUNTER_VISION_TIMEOUT_MS = 35_000
export const HUNTER_VISION_RETRY_TIMEOUT_MS = 20_000

export function buildHunterGenerationConfig(
  format: HunterCoordFormat = HUNTER_COORD_FORMAT,
): GeminiVisionGenerationConfig {
  return {
    temperature: 0.3,
    responseMimeType: "application/json",
    responseSchema: buildHunterResponseSchema(format),
    timeoutMs: HUNTER_VISION_TIMEOUT_MS,
  }
}

export const HUNTER_GENERATION_CONFIG: GeminiVisionGenerationConfig = buildHunterGenerationConfig()
