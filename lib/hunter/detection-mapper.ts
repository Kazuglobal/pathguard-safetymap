// =============================================
// きけんハンター: Detection -> HunterHazard 変換 (純粋ロジック)
// Gemini の DetectionItem[] を、タップ採点用の HunterHazard[] へ flatten する。
// =============================================

import type { DetectionCategory, DetectionItem } from "@/lib/hazard-game-types"
import type { HunterHazard } from "@/lib/hunter/types"
import type { RiskSeverity } from "@/lib/hazard-game-types"

/** mapDetectionsToHunterHazards のオプション。 */
export interface MapOptions {
  /** id 生成の prefix となる写真セッションID。 */
  readonly sessionId: string
  /** これ未満の confidence は除外する。既定 0.5。 */
  readonly confidenceThreshold?: number
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.5

/** 探索対象とする危険カテゴリ -> severity の対応。 */
const SEVERITY_BY_CATEGORY: Readonly<Record<HazardCategory, RiskSeverity>> = {
  hazards: "high",
  traffic: "medium",
  obstructions: "low",
}

/** 危険カテゴリ -> 子ども向けの短い日本語ラベル。 */
const TYPE_LABEL_BY_CATEGORY: Readonly<Record<HazardCategory, string>> = {
  hazards: "危険なもの",
  traffic: "車に注意",
  obstructions: "じゃまなもの",
}

/** 危険カテゴリ -> 子ども向けの行動アドバイス。 */
const SAFE_ACTION_BY_CATEGORY: Readonly<Record<HazardCategory, string>> = {
  hazards: "あぶないものの 近くは はなれて 歩こう。",
  traffic: "車が来ないか、止まって 左右を 見よう。",
  obstructions: "せまい場所では 車道に 出ないように 気をつけよう。",
}

/** safety_equipment を除いた、探索対象カテゴリ。 */
type HazardCategory = Exclude<DetectionCategory, "safety_equipment">

function isHazardCategory(category: DetectionCategory): category is HazardCategory {
  return category !== "safety_equipment"
}

/**
 * DetectionItem[] を HunterHazard[] へ flatten する純粋関数。
 *
 * - safety_equipment は探索対象から除外。
 * - confidence < confidenceThreshold(既定 0.5) は除外。
 * - detIndex は元配列基準で固定し、除外があっても安定IDを保つ。
 */
export function mapDetectionsToHunterHazards(
  detections: readonly DetectionItem[],
  options: MapOptions,
): HunterHazard[] {
  const { sessionId } = options
  const confidenceThreshold =
    options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD

  return detections.reduce<HunterHazard[]>((hazards, item, detIndex) => {
    if (!isHazardCategory(item.category)) {
      return hazards
    }
    if (item.confidence < confidenceThreshold) {
      return hazards
    }

    const category = item.category
    const kidExplanation = item.description || item.label

    const flattened = item.positions.map((pos, posIndex): HunterHazard => ({
      id: `${sessionId}-${detIndex}-${posIndex}`,
      type: TYPE_LABEL_BY_CATEGORY[category],
      region: { x: pos.x, y: pos.y, w: pos.width, h: pos.height },
      severity: SEVERITY_BY_CATEGORY[category],
      kidExplanation,
      safeAction: SAFE_ACTION_BY_CATEGORY[category],
      confidence: item.confidence,
    }))

    return [...hazards, ...flattened]
  }, [])
}
