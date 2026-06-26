// =============================================
// きけんハンター API 入力検証 (Phase 0)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md §8
// zod による純粋な検証。ルートから切り出してユニットテスト可能にする。
// =============================================

import { z } from "zod"

import type { HunterHazard, HunterTap } from "@/lib/hunter/types"

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
})

export const hunterTapSchema = z.object({
  x: z.number().gte(0).lte(1),
  y: z.number().gte(0).lte(1),
})

/**
 * /api/hunter/analyze の入力。
 * consent は「マスク済み写真を第三者AI(国外)へ送信する」ことへの同意ゲート (B3)。必ず true。
 */
export const hunterAnalyzeSchema = z.object({
  imageBase64: z.string().min(1).max(MAX_IMAGE_LENGTH),
  pin: hunterPinSchema,
  consent: z.literal(true),
})

/** /api/hunter/session の入力 (サーバ再採点)。 */
export const hunterSessionSchema = z.object({
  mode: z.literal("explore"),
  hazards: z.array(hunterHazardSchema).max(50),
  taps: z.array(hunterTapSchema).max(200),
})

// z.infer はこの環境で全フィールドを optional 推論するため、明示的 interface を使う。
// ランタイム検証は zod、型は下記 interface（検証後にキャスト）。
export interface HunterAnalyzeInput {
  imageBase64: string
  pin: { latitude: number; longitude: number }
  consent: true
}

export interface HunterSessionInput {
  mode: "explore"
  hazards: HunterHazard[]
  taps: HunterTap[]
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
