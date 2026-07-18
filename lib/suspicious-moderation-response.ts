export type SuspiciousModerationOutcome = "published" | "pending" | "failed"

interface SuspiciousModerationResponse {
  mode?: "off" | "shadow" | "live"
  skipped?: boolean
  verdict?: { status?: string }
  report?: { status?: string } | null
}

export function resolveSuspiciousModerationOutcome(
  responseOk: boolean,
  body: SuspiciousModerationResponse,
): SuspiciousModerationOutcome {
  if (!responseOk) return "failed"

  // off/shadowはDBを公開状態へ更新しないため、AI verdictがapproveでも
  // ユーザーへ公開済みとは案内しない。
  if (body.mode === "off" || body.mode === "shadow") return "pending"

  if (!body.verdict || !body.report) return "failed"
  return body.verdict.status === "approved" &&
    body.report.status === "approved"
    ? "published"
    : "pending"
}
