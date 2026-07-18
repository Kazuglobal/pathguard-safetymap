import type { DangerModerationStatus } from "@/lib/danger-report-moderation"

export type HumanModerationStatus = "approved" | "rejected"

export interface ModerationEvaluationSample {
  humanStatus: HumanModerationStatus
  aiStatus: DangerModerationStatus
  fallback: boolean
}

type AiStatusCounts = Record<DangerModerationStatus, number>

export interface DangerModerationEvaluation {
  total: number
  confusionMatrix: Record<HumanModerationStatus, AiStatusCounts>
  dangerousErrorCount: number
  dangerousErrorRate: number
  approveRecall: number
  fallbackRate: number
  phase0GatePassed: boolean
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

export function evaluateDangerModeration(
  samples: readonly ModerationEvaluationSample[],
): DangerModerationEvaluation {
  const confusionMatrix: DangerModerationEvaluation["confusionMatrix"] = {
    approved: { approved: 0, needs_review: 0, escalated: 0 },
    rejected: { approved: 0, needs_review: 0, escalated: 0 },
  }

  let fallbackCount = 0
  for (const sample of samples) {
    confusionMatrix[sample.humanStatus][sample.aiStatus] += 1
    if (sample.fallback) fallbackCount += 1
  }

  const humanApproved =
    confusionMatrix.approved.approved +
    confusionMatrix.approved.needs_review +
    confusionMatrix.approved.escalated
  const humanRejected =
    confusionMatrix.rejected.approved +
    confusionMatrix.rejected.needs_review +
    confusionMatrix.rejected.escalated
  const dangerousErrorCount = confusionMatrix.rejected.approved
  const dangerousErrorRate = ratio(
    dangerousErrorCount,
    humanRejected,
  )
  const approveRecall = ratio(
    confusionMatrix.approved.approved,
    humanApproved,
  )

  return {
    total: samples.length,
    confusionMatrix,
    dangerousErrorCount,
    dangerousErrorRate,
    approveRecall,
    fallbackRate: ratio(fallbackCount, samples.length),
    phase0GatePassed:
      dangerousErrorCount === 0 && approveRecall >= 0.3,
  }
}
