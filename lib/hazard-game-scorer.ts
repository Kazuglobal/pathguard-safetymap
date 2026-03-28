/**
 * 決定的スコアリングエンジン (A8: ScoreAgent 相当)
 *
 * AGENT_TEAM.md の仕様に基づき、VisionResult と ThinkResult から
 * 純粋関数で SafetyScore を算出する。外部依存なし。
 */

import type {
  ComparisonResult,
  VisionResult,
  ThinkResult,
  SafetyScore,
  SafetyLevel,
  ScoreBreakdownItem,
  DetectionItem,
  ContextualRisk,
} from "./hazard-game-types"

// ---- 安全設備チェック ----

const SAFETY_EQUIPMENT_PENALTIES: Record<string, number> = {
  guardrail: -10,
  crosswalk: -8,
  traffic_light: -6,
  sidewalk: -6,
}

const ROAD_SCENE_KEYWORDS = ["crosswalk", "横断歩道", "traffic_light", "guardrail", "sidewalk", "歩道"]

function hasLabel(items: readonly DetectionItem[], pattern: string): boolean {
  const p = pattern.toLowerCase()
  return items.some(
    (item) =>
      item.label.toLowerCase().includes(p) ||
      item.description.toLowerCase().includes(p)
  )
}

export function checkSafetyEquipment(
  equipment: readonly DetectionItem[]
): readonly ScoreBreakdownItem[] {
  return Object.entries(SAFETY_EQUIPMENT_PENALTIES)
    .filter(([label]) => !hasLabel(equipment, label))
    .map(([label, penalty]) => {
      const jaLabel = LABEL_JA[label] ?? label
      return {
        item: jaLabel,
        category: "safety_equipment" as const,
        points: penalty,
        reason: `${jaLabel}が検出されませんでした`,
      }
    })
}

// ---- 危険要素チェック ----

const HAZARD_PENALTY_PER_ITEM = -10

export function checkHazards(
  hazards: readonly DetectionItem[]
): readonly ScoreBreakdownItem[] {
  return hazards.map((h) => ({
    item: h.label || h.description,
    category: "hazards" as const,
    points: HAZARD_PENALTY_PER_ITEM,
    reason: `危険要素「${h.label || h.description}」を${h.count}件検出`,
  }))
}

// ---- 交通チェック ----

export function checkTraffic(
  traffic: readonly DetectionItem[]
): readonly ScoreBreakdownItem[] {
  const results: ScoreBreakdownItem[] = []
  const totalVehicles = traffic.reduce((sum, t) => sum + t.count, 0)

  if (totalVehicles > 8) {
    results.push({
      item: "車両過密",
      category: "traffic",
      points: -10,
      reason: `${totalVehicles}台の車両を検出（8台超）`,
    })
  } else if (totalVehicles > 5) {
    results.push({
      item: "車両多数",
      category: "traffic",
      points: -5,
      reason: `${totalVehicles}台の車両を検出（5台超）`,
    })
  }

  const hasBikeNearPedestrian = traffic.some(
    (t) =>
      t.label.toLowerCase().includes("motorcycle") ||
      t.label.toLowerCase().includes("バイク") ||
      t.label.toLowerCase().includes("原付")
  )
  if (hasBikeNearPedestrian) {
    results.push({
      item: "バイク接近",
      category: "traffic",
      points: -5,
      reason: "歩行者エリア付近にバイクを検出",
    })
  }

  return results
}

// ---- 障害物チェック ----

const OBSTRUCTION_PENALTY_PER_ITEM = -8

export function checkObstructions(
  obstructions: readonly DetectionItem[]
): readonly ScoreBreakdownItem[] {
  return obstructions.map((o) => ({
    item: o.label || o.description,
    category: "obstructions" as const,
    points: OBSTRUCTION_PENALTY_PER_ITEM,
    reason: `障害物「${o.label || o.description}」を検出`,
  }))
}

// ---- 文脈リスクチェック ----

const CONTEXTUAL_RISK_PENALTY: Record<string, number> = {
  high: -5,
  medium: -3,
  low: -1,
}

export function checkContextualRisks(
  risks: readonly ContextualRisk[]
): readonly ScoreBreakdownItem[] {
  return risks.map((r) => ({
    item: r.description.slice(0, 40),
    category: "contextual" as const,
    points: CONTEXTUAL_RISK_PENALTY[r.severity] ?? -1,
    reason: `${r.severity === "high" ? "高" : r.severity === "medium" ? "中" : "低"}リスク: ${r.description}`,
  }))
}

// ---- レベル判定 ----

export function determineLevel(score: number): SafetyLevel {
  if (score >= 80) return "safe"
  if (score >= 60) return "caution"
  if (score >= 40) return "warning"
  return "danger"
}

// ---- メイン関数 ----

const BASE_SCORE = 100

export function calculateSafetyScore(
  vision: VisionResult,
  think: ThinkResult
): SafetyScore {
  const isRoadScene =
    vision.traffic.length > 0 ||
    vision.safetyEquipment.some((e) =>
      ROAD_SCENE_KEYWORDS.some(
        (kw) => e.label.toLowerCase().includes(kw) || e.description.includes(kw)
      )
    )

  const breakdown: ScoreBreakdownItem[] = [
    ...(isRoadScene ? checkSafetyEquipment(vision.safetyEquipment) : []),
    ...checkHazards(vision.hazards),
    ...checkTraffic(vision.traffic),
    ...checkObstructions(vision.obstructions),
    ...checkContextualRisks(think.contextualRisks),
  ]

  const totalDeductions = breakdown.reduce((sum, b) => sum + b.points, 0)
  const rawScore = BASE_SCORE + totalDeductions
  const score = Math.max(0, Math.min(100, rawScore))

  const highCount = think.contextualRisks.filter(
    (r) => r.severity === "high"
  ).length
  const mediumCount = think.contextualRisks.filter(
    (r) => r.severity === "medium"
  ).length
  const lowCount = think.contextualRisks.filter(
    (r) => r.severity === "low"
  ).length

  return {
    score,
    level: determineLevel(score),
    breakdown,
    detectionSummary: {
      safetyEquipmentCount: vision.safetyEquipment.length,
      hazardCount: vision.hazards.length,
      trafficCount: vision.traffic.length,
      obstructionCount: vision.obstructions.length,
    },
    thinkSummary: {
      contextualRiskCount: think.contextualRisks.length,
      highSeverityCount: highCount,
      mediumSeverityCount: mediumCount,
      lowSeverityCount: lowCount,
    },
  }
}

// ---- ユーザーマーキングボーナス加算 ----

export function calculateFinalScoreWithBonus(
  baseScore: SafetyScore,
  comparison: ComparisonResult
): SafetyScore {
  const finalScore = Math.min(100, baseScore.score + comparison.bonusPoints)
  const bonusItem = {
    item: "ユーザーマーキングボーナス",
    category: "contextual" as const,
    points: comparison.bonusPoints,
    reason: `精度${comparison.accuracyScore}%、${comparison.matches.length}件マッチ`,
  }

  return {
    ...baseScore,
    score: finalScore,
    level: determineLevel(finalScore),
    breakdown: [...baseScore.breakdown, bonusItem],
  }
}

// ---- ラベル日本語マッピング ----

const LABEL_JA: Record<string, string> = {
  guardrail: "ガードレール",
  crosswalk: "横断歩道",
  traffic_light: "信号機",
  sidewalk: "歩道",
}
