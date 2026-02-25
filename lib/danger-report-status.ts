export type InitialDangerReportStatus = "pending" | "published"

export function resolveInitialDangerReportStatus(
  requestedStatus: string | null | undefined
): InitialDangerReportStatus {
  return requestedStatus === "published" ? "published" : "pending"
}

type MinimalPostgrestError = {
  code?: string | null
  message?: string | null
}

export function shouldRetryDangerReportInsertAsPending(
  requestedStatus: string | null | undefined,
  error: MinimalPostgrestError | null | undefined,
): boolean {
  if (requestedStatus !== "published" || !error) return false
  const code = (error.code || "").trim()
  const message = (error.message || "").toLowerCase()
  const isRlsViolation = code === "42501" || message.includes("row-level security policy")
  const isStatusCheckViolation =
    code === "23514" && (message.includes("danger_reports_status_check") || message.includes("check constraint"))
  return isRlsViolation || isStatusCheckViolation
}
