// =============================================
// きけんハンター きろくの再プレイ (純粋ロジック)
// hazard_detections の行を、再解析なし(AI コスト 0・待ち 0)で探索できる
// HunterHazard へ戻す。壊れた行(領域が 0..1 外・必須文言なし)は静かに落とす。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import { fitHitZones } from "@/lib/hunter/hit-zone"
import { normalizeKind } from "@/lib/hunter/kid-copy"
import type { HunterHazard, HunterPoint, HunterRegion } from "@/lib/hunter/types"

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

/** region JSON に同居させた当たり枠(保存時の値)。region の内側でなければ使わない。 */
function storedHitRegion(raw: Record<string, unknown> | null, region: HunterRegion): HunterRegion | null {
  const hit = raw && typeof raw.hitRegion === "object" ? toRegion(raw.hitRegion as Record<string, unknown>) : null
  if (!hit) return null
  const eps = 1e-6
  const inside =
    hit.x >= region.x - eps &&
    hit.y >= region.y - eps &&
    hit.x + hit.w <= region.x + region.w + eps &&
    hit.y + hit.h <= region.y + region.h + eps
  return inside ? hit : null
}

function storedFocus(raw: Record<string, unknown> | null): HunterPoint | null {
  const focus = raw?.focusPoint as { x?: unknown; y?: unknown } | undefined
  if (!focus || !isUnit(focus.x) || !isUnit(focus.y)) return null
  return { x: focus.x, y: focus.y }
}

interface ParsedDetection {
  readonly base: Omit<HunterHazard, "id" | "hitRegion" | "focusPoint">
  readonly hit: HunterRegion | null
  readonly focus: HunterPoint | null
}

function parseDetection(detection: StoredDetectionLike): ParsedDetection | null {
  const region = toRegion(detection.region)
  const type = detection.type?.trim()
  const kidExplanation = detection.kidExplanation?.trim()
  const safeAction = detection.safeAction?.trim()
  if (!region || !type || !kidExplanation || !safeAction) return null
  return {
    base: {
      type,
      region,
      severity: toSeverity(detection.severity),
      kidExplanation,
      safeAction,
      confidence: isUnit(detection.confidence) ? detection.confidence : 0.7,
      kind: normalizeKind(detection.kind ?? undefined),
      accidentLink: detection.accidentLink ?? null,
    },
    hit: storedHitRegion(detection.region, region),
    focus: storedFocus(detection.region),
  }
}

/**
 * 保存済み検出 → 探索用 hazards。ID は `${sessionId}-${index}`(生成時と同じ規約)。
 * 当たり枠は保存した値をそのまま使う。当たり枠の無い旧データは、保存済みの focus(無ければ枠の中心)から
 * 同じ規則(fitHitZones)で作るので、きろくの再プレイでも「適当に押しても正解」にならない。
 */
export function detectionsToHazards(
  detections: readonly StoredDetectionLike[],
  sessionId: string,
): HunterHazard[] {
  const parsed = detections.map(parseDetection).filter((d): d is ParsedDetection => d !== null)
  const allStored = parsed.every((d) => d.hit !== null)
  const derived = allStored ? null : fitHitZones(parsed.map((d) => ({ region: d.base.region, focus: d.focus })))
  return parsed.map((d, i) => {
    const hit = d.hit as HunterRegion
    const zone = derived ? derived[i] : { hitRegion: hit, focusPoint: d.focus ?? centerOf(hit) }
    return { id: `${sessionId}-${i}`, ...d.base, hitRegion: zone.hitRegion, focusPoint: zone.focusPoint }
  })
}

function centerOf(region: HunterRegion): HunterPoint {
  return { x: region.x + region.w / 2, y: region.y + region.h / 2 }
}
