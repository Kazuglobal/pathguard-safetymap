export type InitialDangerReportStatus = "pending" | "published"

export function resolveInitialDangerReportStatus(
  requestedStatus: string | null | undefined
): InitialDangerReportStatus {
  return requestedStatus === "published" ? "published" : "pending"
}
