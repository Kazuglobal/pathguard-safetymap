// =============================================
// きけんハンター 生AI出力スキーマ (zod) — 関心分離
// 専用ハンターAIが返す「生の」JSONをここで検証する。
// - トップレベルは1フィールドの型崩れで全滅させない(付随フィールドは
//   各々 .catch で握りつぶし、dangerPoints を巻き添えにしない)。
// - 未知 kind は "other" に矯正。
// - danger point の必須は region のみ。severity/confidence/文言/quiz の
//   型崩れは .catch で undefined 化し、点そのものは保持する(sanitize が
//   kind 既定の severity・子ども文・クイズで補完する)。写真に置けない
//   (region 不正)点だけをドロップする。
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
  /** 生成時に最初に書かせる根拠(分析・eval採取用。表示系は読まない)。 */
  evidence?: string
  kind: HunterDangerKind
  kidType?: string
  region: RawAiRegion
  severity?: RiskSeverity
  confidence?: number
  whyDangerous?: string
  safeAction?: string
  accidentLink?: string | null
  /** 欠落・破損時は undefined。sanitize が kind 既定クイズへ補完する。 */
  quiz?: RawAiQuiz
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

// 大文字/前後空白の severity("High"・" medium ")も拾う。未知値・非文字列は
// undefined へ倒し、点を落とさない(sanitize が kind 既定 severity で補完)。
const severitySchema = z
  .preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : undefined),
    z.enum(["high", "medium", "low"]).optional(),
  )
  .catch(undefined)

// "true"/"false"(文字列)や 0/1 も真偽へ寄せる。判別不能は undefined
// (= 呼び出し側で既定 true。「使えない」と誤断定しない)。
const imageUsableSchema = z
  .preprocess((v) => {
    if (typeof v === "boolean") return v
    if (typeof v === "string") {
      const s = v.trim().toLowerCase()
      if (s === "true" || s === "1" || s === "yes") return true
      if (s === "false" || s === "0" || s === "no") return false
    }
    return undefined
  }, z.boolean().optional())
  .catch(undefined)

/** 座標値を数値へ寄せる(文字列 "400" も拾う)。数値化できなければ null。 */
function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * 0〜100 / 0〜1000スケール座標の混入をサルベージする(Gemini 2.5系はネイティブ検出訓練の癖で
 * 0〜1指示でも別スケールを返すことがある)。そのまま通すと clampRegion(sanitize)が
 * x→1・w→0 に潰し、全ポイントが MIN_AREA 未満で脱落 → guide(empty) へ全滅する。
 * 2値以上が1.5を超える場合だけ同一スケールの出力とみなし、最大値が100以下なら100、
 * 1000以下なら1000でスケール値だけを割る。正規化値との混在は0〜1値を保持する。
 * 単独の外れ値・負数・1000超は推測変換せず、既存の安全側フィルタに委ねる。
 * region 欠落・数値化不能は素通しし、既存スキーマの判定(要素ドロップ)に委ねる。
 * イミュータブル: 入力オブジェクトは変更せず新オブジェクトを返す。
 */
// export: 単体テスト(ai-schema.test.ts)用。
export function salvageRegionScale(point: unknown): unknown {
  if (typeof point !== "object" || point === null) return point
  const region = (point as { region?: unknown }).region
  if (typeof region !== "object" || region === null) return point
  const r = region as { x?: unknown; y?: unknown; w?: unknown; h?: unknown }
  const x = toFiniteNumber(r.x)
  const y = toFiniteNumber(r.y)
  const w = toFiniteNumber(r.w)
  const h = toFiniteNumber(r.h)
  if (x === null || y === null || w === null || h === null) return point
  const values = [x, y, w, h]
  if (values.some((value) => value < 0)) return point
  const scaledValues = values.filter((value) => value > 1.5)
  if (scaledValues.length < 2) return point
  const maxValue = Math.max(...scaledValues)
  const divisor = maxValue <= 100 ? 100 : maxValue <= 1000 ? 1000 : null
  if (divisor === null) return point
  const normalize = (value: number): number => (value > 1.5 ? value / divisor : value)
  return {
    ...(point as Record<string, unknown>),
    region: { x: normalize(x), y: normalize(y), w: normalize(w), h: normalize(h) },
  }
}

// danger point の必須は region のみ。付随フィールドは .catch で型崩れを
// undefined 化し、点そのものは保持する(sanitize が既定値・子ども文で補完)。
const dangerPointSchema = z.preprocess(salvageRegionScale, z.object({
  // 分析・eval採取専用(子ども表示経路なし。sanitize は読まず HunterHazard へ伝播しない)。
  evidence: z.string().optional().catch(undefined),
  kind: zKind,
  kidType: z.string().optional().catch(undefined),
  region: regionSchema,
  severity: severitySchema,
  confidence: zNum.optional().catch(undefined),
  whyDangerous: z.string().optional().catch(undefined),
  safeAction: z.string().optional().catch(undefined),
  accidentLink: z.string().nullable().optional().catch(undefined),
  // 壊れた/欠落クイズでも点は落とさない。素材の検証・差し替えは sanitize が担う。
  quiz: quizSchema.optional().catch(undefined),
}))

const safePointSchema = z.preprocess(salvageRegionScale, z.object({
  kind: zKind.optional().catch(undefined),
  kidType: z.string().optional().catch(undefined),
  region: regionSchema.optional().catch(undefined),
  whyGood: z.string().optional().catch(undefined),
}))

// 付随フィールド1つの型崩れで dangerPoints を巻き添えにしないよう、
// 各フィールドを独立に .catch する(version など未使用キーは自然に無視)。
const topSchema = z.object({
  imageUsable: imageUsableSchema,
  dangerPoints: z.array(z.unknown()).optional().catch([]),
  safePoints: z.array(z.unknown()).optional().catch([]),
  noHazardFollow: z.string().nullable().optional().catch(null),
})

/**
 * 生AI応答を検証して、可能な限り救い出した構造を返す。
 * - imageUsable は欠落・判別不能時 true(=「使えない」と誤断定しない)。
 * - 付随フィールドの型崩れ(stringy imageUsable / 数値 version 等)で
 *   dangerPoints 全体を巻き添えにしない。
 * - dangerPoints/safePoints は要素単位 safeParse。region を復元できない
 *   要素だけをドロップし、severity/quiz 等の破損は保持したまま後段へ渡す。
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
