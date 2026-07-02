// =============================================
// きけんハンター 専用AI リクエスト設定 (Gemini generationConfig)
// 低温度+構造化出力(responseSchema)で、的外れな検出・JSON崩れを構造的に減らす。
// hunter-ai.ts の関心(プロンプト文面/オーケストレーション)から分離する。
// =============================================

import { KID_DANGER_KINDS } from "@/lib/hunter/kid-copy"
import type { GeminiVisionGenerationConfig } from "@/lib/gemini-hazard"

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

const quizSchema = {
  type: "OBJECT",
  properties: {
    question: { type: "STRING" },
    choices: { type: "ARRAY", items: { type: "STRING" } },
    explanation: { type: "STRING" },
  },
  required: ["question", "choices", "explanation"],
}

const dangerPointSchema = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: [...KID_DANGER_KINDS] },
    kidType: { type: "STRING" },
    region: regionSchema,
    severity: { type: "STRING", enum: ["high", "medium", "low"] },
    confidence: { type: "NUMBER" },
    whyDangerous: { type: "STRING" },
    safeAction: { type: "STRING" },
    accidentLink: { type: "STRING", nullable: true },
    quiz: quizSchema,
  },
  required: ["kind", "region", "severity", "confidence", "whyDangerous", "safeAction", "quiz"],
}

const safePointSchema = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: [...KID_DANGER_KINDS] },
    kidType: { type: "STRING" },
    region: regionSchema,
    whyGood: { type: "STRING" },
  },
}

/** 専用ハンターAI応答のJSON Schema(Gemini responseSchema形式)。型・enumだけを縛り、文言の自由度は奪わない。 */
export const HUNTER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    version: { type: "STRING" },
    imageUsable: { type: "BOOLEAN" },
    dangerPoints: { type: "ARRAY", items: dangerPointSchema },
    safePoints: { type: "ARRAY", items: safePointSchema },
    noHazardFollow: { type: "STRING", nullable: true },
  },
  required: ["imageUsable", "dangerPoints"],
} as const

/**
 * 専用ハンターAI呼び出しの generationConfig。
 * - temperature を下げ、的外れな検出(物体=危険の誤判定)のばらつきを抑える。
 * - responseMimeType+responseSchema で構造化出力を強制し、JSON崩れ(parse_error)を構造的に減らす。
 * - 万一 API がこの設定を拒否しても、呼び出し側(hunter-ai.ts)は例外を guide モードへ吸収するため安全側に倒れる。
 */
export const HUNTER_GENERATION_CONFIG: GeminiVisionGenerationConfig = {
  temperature: 0.3,
  responseMimeType: "application/json",
  responseSchema: HUNTER_RESPONSE_SCHEMA,
}
