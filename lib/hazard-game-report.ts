/**
 * 安全レポート生成エンジン (A10: ReportAgent 相当)
 *
 * PipelineAnalysisResult から保護者向け / 行政向けの
 * 構造化レポートを生成する純粋関数。外部依存なし。
 */

import type {
  PipelineAnalysisResult,
  SafetyScore,
  SafetyLevel,
} from "./hazard-game-types"

// ---- Types ----

export type ReportType = "parent" | "municipality"

export interface ReportSection {
  readonly title: string
  readonly content: string
  readonly severity?: "high" | "medium" | "low"
}

export interface SafetyReport {
  readonly title: string
  readonly generatedAt: string
  readonly score: SafetyScore
  readonly sections: readonly ReportSection[]
  readonly recommendations: readonly string[]
}

// ---- Level Labels ----

const LEVEL_LABELS: Record<SafetyLevel, string> = {
  safe: "安全",
  caution: "注意",
  warning: "警告",
  danger: "危険",
}

// ---- Internal Helpers ----

function buildScoreSection(score: SafetyScore): ReportSection {
  const levelLabel = LEVEL_LABELS[score.level]
  return {
    title: "安全スコア",
    content:
      `スコア: ${score.score}/100 (${levelLabel})\n` +
      `検出: 安全設備 ${score.detectionSummary.safetyEquipmentCount}件, ` +
      `危険要素 ${score.detectionSummary.hazardCount}件, ` +
      `交通 ${score.detectionSummary.trafficCount}件, ` +
      `障害物 ${score.detectionSummary.obstructionCount}件`,
  }
}

function buildRiskSection(result: PipelineAnalysisResult): ReportSection {
  const risks = result.think.contextualRisks
  if (risks.length === 0) {
    return {
      title: "リスク評価",
      content: "特筆すべきリスクは検出されませんでした。",
    }
  }

  const lines = risks.map((r) => {
    const sevLabel = r.severity === "high" ? "高" : r.severity === "medium" ? "中" : "低"
    return `[${sevLabel}] ${r.description}`
  })

  const highCount = risks.filter((r) => r.severity === "high").length
  const severity = highCount > 0 ? ("high" as const) : ("medium" as const)

  return {
    title: "リスク評価",
    content: lines.join("\n"),
    severity,
  }
}

function buildDetectionSection(result: PipelineAnalysisResult): ReportSection {
  const { vision } = result
  const lines: string[] = []

  if (vision.safetyEquipment.length > 0) {
    lines.push("【安全設備】")
    for (const item of vision.safetyEquipment) {
      lines.push(`  - ${item.label}: ${item.count}件 (信頼度 ${Math.round(item.confidence * 100)}%)`)
    }
  }

  if (vision.hazards.length > 0) {
    lines.push("【危険要素】")
    for (const item of vision.hazards) {
      lines.push(`  - ${item.label}: ${item.count}件 (信頼度 ${Math.round(item.confidence * 100)}%)`)
    }
  }

  if (vision.traffic.length > 0) {
    lines.push("【交通状況】")
    for (const item of vision.traffic) {
      lines.push(`  - ${item.label}: ${item.count}件 (信頼度 ${Math.round(item.confidence * 100)}%)`)
    }
  }

  if (vision.obstructions.length > 0) {
    lines.push("【障害物】")
    for (const item of vision.obstructions) {
      lines.push(`  - ${item.label}: ${item.count}件 (信頼度 ${Math.round(item.confidence * 100)}%)`)
    }
  }

  return {
    title: "検出結果詳細",
    content: lines.length > 0 ? lines.join("\n") : "検出項目なし",
  }
}

function buildBreakdownSection(score: SafetyScore): ReportSection {
  if (score.breakdown.length === 0) {
    return {
      title: "スコア内訳",
      content: "減点項目はありません。基準点: 100",
    }
  }

  const lines = score.breakdown.map(
    (b) => `${b.reason}: ${b.points}点`
  )
  lines.push(`基準点: 100 → 最終スコア: ${score.score}`)

  return {
    title: "スコア内訳",
    content: lines.join("\n"),
  }
}

function buildRecommendations(result: PipelineAnalysisResult): readonly string[] {
  const unique = new Set([
    ...result.think.priorityImprovements,
    ...result.educationalTips,
  ])
  return Array.from(unique)
}

// ---- Public API ----

export function generateSafetyReport(
  result: PipelineAnalysisResult,
  type: ReportType
): SafetyReport {
  if (type !== "parent" && type !== "municipality") {
    throw new Error(`不明なレポートタイプ: ${type}`)
  }

  if (!result || !result.score || !result.think || !result.vision) {
    throw new Error("Invalid PipelineAnalysisResult: missing required fields")
  }

  const levelLabel = LEVEL_LABELS[result.score.level]
  const generatedAt = new Date().toISOString()

  if (type === "parent") {
    return {
      title: `通学路安全レポート（保護者向け） - ${levelLabel}`,
      generatedAt,
      score: result.score,
      sections: [
        buildScoreSection(result.score),
        buildRiskSection(result),
      ],
      recommendations: buildRecommendations(result),
    }
  }

  // municipality
  return {
    title: `通学路安全レポート（行政向け） - ${levelLabel}`,
    generatedAt,
    score: result.score,
    sections: [
      buildScoreSection(result.score),
      buildDetectionSection(result),
      buildBreakdownSection(result.score),
      buildRiskSection(result),
    ],
    recommendations: buildRecommendations(result),
  }
}

export function formatReportAsText(report: SafetyReport): string {
  const lines: string[] = []

  lines.push("=" .repeat(50))
  lines.push(report.title)
  lines.push("=" .repeat(50))
  lines.push("")
  lines.push(`生成日時: ${report.generatedAt}`)
  lines.push("")

  for (const section of report.sections) {
    lines.push(`--- ${section.title} ---`)
    lines.push(section.content)
    lines.push("")
  }

  if (report.recommendations.length > 0) {
    lines.push("--- 推奨事項 ---")
    for (const [i, rec] of report.recommendations.entries()) {
      lines.push(`${i + 1}. ${rec}`)
    }
    lines.push("")
  }

  lines.push("=" .repeat(50))

  return lines.join("\n")
}
