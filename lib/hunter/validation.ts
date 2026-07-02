// =============================================
// きけんハンター API 入力検証 (Phase 0)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md §8
// zod による純粋な検証。ルートから切り出してユニットテスト可能にする。
// =============================================

import { z } from "zod"

import { KID_DANGER_KINDS } from "@/lib/hunter/kid-copy"
import type {
  HunterAccidentSummary,
  HunterHazard,
  HunterQuizAnswer,
  HunterQuizItem,
  HunterTap,
} from "@/lib/hunter/types"

const MAX_IMAGE_LENGTH = 25 * 1024 * 1024

export const hunterPinSchema = z.object({
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
})

export const hunterRegionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite(),
  h: z.number().finite(),
})

export const hunterHazardSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  region: hunterRegionSchema,
  severity: z.enum(["high", "medium", "low"]),
  kidExplanation: z.string(),
  safeAction: z.string(),
  confidence: z.number().finite(),
  // 後方互換: 旧クライアント/テストの hazard リテラルが壊れないよう任意。
  kind: z.enum(KID_DANGER_KINDS).optional(),
  accidentLink: z.string().nullable().optional(),
})

export const hunterTapSchema = z.object({
  x: z.number().gte(0).lte(1),
  y: z.number().gte(0).lte(1),
})

export const hunterQuizChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
})

export const hunterQuizItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["place", "choice"]),
  theme: z.string().nullable(),
  question: z.string(),
  choices: z.array(hunterQuizChoiceSchema).max(6).optional(),
  correctChoiceId: z.string().optional(),
  answerHazardId: z.string().optional(),
  answerRegion: hunterRegionSchema.optional(),
  explanation: z.string(),
  accidentLink: z.string().nullable().optional(),
})

/**
 * /api/hunter/analyze の入力。
 * consent は「マスク済み写真を第三者AI(国外)へ送信する」ことへの同意ゲート (B3)。必ず true。
 */
export const hunterAnalyzeSchema = z.object({
  imageBase64: z.string().min(1).max(MAX_IMAGE_LENGTH),
  pin: hunterPinSchema,
  consent: z.literal(true),
  // 保存はオプトイン。既定 (未指定) は保存しない＝従来挙動を維持 (後方互換)。
  save: z.boolean().optional(),
})

export const hunterAccidentSummarySchema = z.object({
  hasData: z.boolean(),
  riskScore: z.number().finite(),
  riskLevel: z.string(),
  riskLabel: z.string(),
  riskEmoji: z.string(),
  totalAccidents: z.number().finite(),
  childInvolved: z.number().finite(),
  topAccidentType: z.string().nullable(),
  peakTimeSlot: z.string().nullable(),
  kidMessage: z.string(),
})

export const hunterQuizAnswerSchema = z.object({
  itemId: z.string().min(1),
  tap: hunterTapSchema.optional(),
  choiceId: z.string().optional(),
})

/**
 * /api/hunter/session の入力 (サーバ再採点)。
 * explore: hazards + taps を再採点。
 * quiz: クライアントが表示したのと同一の items を送り、answers を再採点する。
 *
 * 注(トラスト境界): Phase0 は保存なし=ステートレスのため、hazards/items の「定義」は
 * クライアント供給であり、サーバは点数を信用せず定義から決定的に再採点するが、
 * 正解鍵自体がクライアント由来である以上、厳密なトラスト境界ではない(改ざん可能)。
 * 保存/順位/恒久報酬が無いため Phase0 では実害なし。Phase1 で匿名サーバキャッシュへ格上げ。
 */
export const hunterSessionSchema = z
  .object({
    mode: z.enum(["explore", "quiz"]),
    hazards: z.array(hunterHazardSchema).max(50).optional(),
    taps: z.array(hunterTapSchema).max(200).optional(),
    accident: hunterAccidentSummarySchema.optional(),
    items: z.array(hunterQuizItemSchema).max(20).optional(),
    answers: z.array(hunterQuizAnswerSchema).max(50).optional(),
    sessionId: z.string().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "quiz") {
      if (!data.items || data.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "クイズの採点に必要な出題がありません",
          path: ["items"],
        })
      }
    } else if (data.mode === "explore") {
      if (!data.hazards || data.hazards.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "採点に必要な危険ポイントがありません",
          path: ["hazards"],
        })
      }
    }
  })

// z.infer はこの環境で全フィールドを optional 推論するため、明示的 interface を使う。
// ランタイム検証は zod、型は下記 interface（検証後にキャスト）。
export interface HunterAnalyzeInput {
  imageBase64: string
  pin: { latitude: number; longitude: number }
  consent: true
  save?: boolean
}

export interface HunterSessionInput {
  mode: "explore" | "quiz"
  hazards?: HunterHazard[]
  taps?: HunterTap[]
  accident?: HunterAccidentSummary
  items?: HunterQuizItem[]
  answers?: HunterQuizAnswer[]
  sessionId?: string
}

// strictNullChecks:false では判別共用体の絞り込みが効かないため、単一形状にする。
export interface ParseResult<T> {
  ok: boolean
  data?: T
  error?: string
}

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return "入力が正しくありません"
  const path = issue.path.join(".")
  return path ? `${path}: ${issue.message}` : issue.message
}

export function parseAnalyzeBody(body: unknown): ParseResult<HunterAnalyzeInput> {
  const result = hunterAnalyzeSchema.safeParse(body)
  if (result.success) return { ok: true, data: result.data as HunterAnalyzeInput }
  // consent 不足は専用メッセージで区別しやすくする
  const consentIssue = result.error.issues.find((i) => i.path[0] === "consent")
  if (consentIssue) {
    return { ok: false, error: "第三者AIへの送信に同意が必要です" }
  }
  return { ok: false, error: firstIssueMessage(result.error) }
}

export function parseSessionBody(body: unknown): ParseResult<HunterSessionInput> {
  const result = hunterSessionSchema.safeParse(body)
  if (result.success) return { ok: true, data: result.data as HunterSessionInput }
  return { ok: false, error: firstIssueMessage(result.error) }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * photoId が UUID 形式か検証する。
 * - 文字列でなければ error。
 * - UUID 形式でなければ error。
 * - 正しければ { ok: true, id } を返す。
 */
export function parsePhotoId(value: unknown): { ok: boolean; id?: string; error?: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "写真IDが正しくありません" }
  }
  if (!UUID_REGEX.test(value)) {
    return { ok: false, error: "写真IDの形式が正しくありません" }
  }
  return { ok: true, id: value }
}
