import type { ARLearningTourStatus } from "@/lib/ar-learning-tour"
import type { DangerReport } from "@/lib/types"

export interface RouteLearningProgressSummary {
  totalCount: number
  reviewedCount: number
  savedCount: number
  completedCount: number
  pendingCount: number
  isComplete: boolean
  revisitReports: DangerReport[]
  highestRiskReport: DangerReport | null
}

export function summarizeRouteLearningProgress(
  reports: DangerReport[],
  progress: Record<string, ARLearningTourStatus>
): RouteLearningProgressSummary {
  const reviewedReports: DangerReport[] = []
  const revisitReports: DangerReport[] = []
  let pendingCount = 0

  for (const report of reports) {
    const status = progress[report.id] ?? "pending"
    if (status === "reviewed") {
      reviewedReports.push(report)
    } else if (status === "saved") {
      revisitReports.push(report)
    } else {
      pendingCount += 1
    }
  }

  const highestRiskReport =
    reports.reduce<DangerReport | null>((highest, current) => {
      if (!highest) return current
      return current.danger_level > highest.danger_level ? current : highest
    }, null) ?? null

  const completedCount = reviewedReports.length + revisitReports.length

  return {
    totalCount: reports.length,
    reviewedCount: reviewedReports.length,
    savedCount: revisitReports.length,
    completedCount,
    pendingCount,
    isComplete: reports.length > 0 && pendingCount === 0,
    revisitReports,
    highestRiskReport,
  }
}
