export function isAbortLikeError(error: unknown): boolean {
  if (!error) return false
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error)

  return (
    message.includes("The operation was aborted") ||
    message.includes("operation was aborted") ||
    message.includes("aborted") ||
    message.includes("AbortError")
  )
}

export function isTransientFetchError(error: unknown): boolean {
  if (!error) return false
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error)

  return (
    isAbortLikeError(error) ||
    message.includes("fetch failed") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network_error") ||
    message.includes("timeout")
  )
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
