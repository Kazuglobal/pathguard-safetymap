// =============================================
// きけんハンター きろくの再プレイ (純粋ロジック)
// hazard_detections の行を、再解析なし(AI コスト 0・待ち 0)で探索できる
// HunterHazard へ戻す。壊れた行(領域が 0..1 外・必須文言なし)は静かに落とす。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import { normalizeKind } from "@/lib/hunter/kid-copy"
import type { HunterHazard, HunterRegion } from "@/lib/hunter/types"

export interface StoredDetectionLike {
  readonly type: string | null
  readonly region: Record<string, unknown> | null
  readonly severity: string | null
  readonly kidExplanation: string | null
  readonly safeAction: string | null
  readonly confidence: number | null
  readonly kind?: string | null
  readonly accidentLink?: string | null
}

function isUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

function toRegion(raw: Record<string, unknown> | null): HunterRegion | null {
  if (!raw) return null
  const { x, y, w, h } = raw
  if (!isUnit(x) || !isUnit(y) || !isUnit(w) || !isUnit(h)) return null
  if (w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) }
}

function toSeverity(raw: string | null): RiskSeverity {
  return raw === "high" || raw === "medium" || raw === "low" ? raw : "medium"
}

/** 保存済み検出 → 探索用 hazards。ID は `${sessionId}-${index}`(生成時と同じ規約)。 */
export function detectionsToHazards(
  detections: readonly StoredDetectionLike[],
  sessionId: string,
): HunterHazard[] {
  const hazards: HunterHazard[] = []
  for (const detection of detections) {
    const region = toRegion(detection.region)
    const type = detection.type?.trim()
    const kidExplanation = detection.kidExplanation?.trim()
    const safeAction = detection.safeAction?.trim()
    if (!region || !type || !kidExplanation || !safeAction) continue
    hazards.push({
      id: `${sessionId}-${hazards.length}`,
      type,
      region,
      severity: toSeverity(detection.severity),
      kidExplanation,
      safeAction,
      confidence: isUnit(detection.confidence) ? detection.confidence : 0.7,
      kind: normalizeKind(detection.kind ?? undefined),
      accidentLink: detection.accidentLink ?? null,
    })
  }
  return hazards
}
