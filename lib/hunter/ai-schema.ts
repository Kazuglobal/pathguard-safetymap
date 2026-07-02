// =============================================
// きけんハンター 生AI出力スキーマ (zod) — 関心分離
// 専用ハンターAIが返す「生の」JSONをここで検証する。
// - トップレベルは緩く受け、dangerPoints は要素ごとに safeParse して
//   壊れた要素だけドロップ(全滅させない)。
// - 未知 kind は "other" に矯正。
// - quiz 素材(question/choices/explanation)が無い point はドロップ
//   (place→choice フォールバック元データを構造保証)。
// types.ts はこの生AI型に依存しない(ドメイン型と分離)。
// =============================================

import { z } from "zod"

import {
  KID_DANGER_KINDS,
  normalizeKind,
  type HunterDangerKind,
} from "@/lib/hunter/kid-copy"
import type { RiskSeverity } from "@/lib/hazard-game-types"

// ---- 生AI型 (strictNullChecks:false 環境では z.infer が緩むため明示interface) ----

export interface RawAiRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface RawAiQuiz {
  /** index 0 = 正解 */
  question: string
  choices: string[]
  explanation: string
}

export interface RawDangerPoint {
  kind: HunterDangerKind
  kidType?: string
  region: RawAiRegion
  severity?: RiskSeverity
  confidence?: number
  whyDangerous?: string
  safeAction?: string
  accidentLink?: string | null
  quiz: RawAiQuiz
}

export interface RawSafePoint {
  kind?: HunterDangerKind
  kidType?: string
  region?: RawAiRegion
  whyGood?: string
}

export interface ValidatedHunterResponse {
  imageUsable: boolean
  dangerPoints: RawDangerPoint[]
  safePoints: RawSafePoint[]
  noHazardFollow: string | null
}

// ---- zod スキーマ ----

const zNum = z.coerce.number().finite()
const zKind = z.preprocess((v) => normalizeKind(v), z.enum(KID_DANGER_KINDS))

const regionSchema = z.object({ x: zNum, y: zNum, w: zNum, h: zNum })

const quizSchema = z.object({
  question: z.string().min(1),
  // index 0 = 正解。最低2(正解+誤答1)。多めに来ても許容(後段で4に整える)。
  choices: z.array(z.string().min(1)).min(2),
  explanation: z.string().min(1),
})

const dangerPointSchema = z.object({
  kind: zKind,
  kidType: z.string().optional(),
  region: regionSchema,
  severity: z.enum(["high", "medium", "low"]).optional(),
  confidence: zNum.optional(),
  whyDangerous: z.string().optional(),
  safeAction: z.string().optional(),
  accidentLink: z.string().nullable().optional(),
  quiz: quizSchema, // 必須: quiz 素材が無い point はドロップ
})

const safePointSchema = z.object({
  kind: zKind.optional(),
  kidType: z.string().optional(),
  region: regionSchema.optional(),
  whyGood: z.string().optional(),
})

const topSchema = z.object({
  version: z.string().nullable().optional(),
  imageUsable: z.boolean().nullable().optional(),
  dangerPoints: z.array(z.unknown()).nullable().optional(),
  safePoints: z.array(z.unknown()).nullable().optional(),
  noHazardFollow: z.string().nullable().optional(),
})

/**
 * 生AI応答を検証して、壊れた要素を落とした構造を返す。
 * - imageUsable は欠落時 true(=「使えない」と誤断定しない)。
 * - dangerPoints/safePoints は要素単位 safeParse で壊れた要素のみドロップ。
 */
export function validateHunterResponse(raw: unknown): ValidatedHunterResponse {
  const top = topSchema.safeParse(raw)
  if (!top.success) {
    return { imageUsable: true, dangerPoints: [], safePoints: [], noHazardFollow: null }
  }

  const data = top.data
  const dangerPoints: RawDangerPoint[] = []
  for (const candidate of data.dangerPoints ?? []) {
    const parsed = dangerPointSchema.safeParse(candidate)
    if (parsed.success) dangerPoints.push(parsed.data as RawDangerPoint)
  }

  const safePoints: RawSafePoint[] = []
  for (const candidate of data.safePoints ?? []) {
    const parsed = safePointSchema.safeParse(candidate)
    if (parsed.success) safePoints.push(parsed.data as RawSafePoint)
  }

  return {
    imageUsable: data.imageUsable ?? true,
    dangerPoints,
    safePoints,
    noHazardFollow: data.noHazardFollow ?? null,
  }
}
