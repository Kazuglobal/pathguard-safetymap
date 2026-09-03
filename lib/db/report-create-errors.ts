export class ReportCreateRateLimitError extends Error {
  constructor(readonly reset: number) {
    super('Report creation limit exceeded')
    this.name = 'ReportCreateRateLimitError'
  }
}

export class ReportCreateUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Report creation is temporarily unavailable', { cause })
    this.name = 'ReportCreateUnavailableError'
  }
}

/** Drizzle and D1 may wrap the trigger's SQLite error in multiple causes. */
export function isReportCreateLimitViolation(error: unknown): boolean {
  let current = error
  for (let depth = 0; depth < 6 && current instanceof Error; depth++) {
    if (/\bREPORT_CREATE_(HOURLY|DAILY)_LIMIT\b/.test(current.message)) return true
    current = current.cause
  }
  return false
}
