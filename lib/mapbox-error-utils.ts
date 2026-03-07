type MapboxErrorLike = {
  error?: unknown
  sourceId?: string | null
}

type ClassifiedMapboxError = {
  severity: "fatal" | "overlay"
  message: string
}

const MLIT_HAZARD_TILE_HOST = "https://disaportaldata.gsi.go.jp/raster/"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === "string" && error.length > 0) {
    return error
  }
  return "不明なエラー"
}

export function classifyMapboxError(event: MapboxErrorLike): ClassifiedMapboxError {
  const message = getErrorMessage(event.error)
  const sourceId = event.sourceId ?? ""

  if (
    message.includes(MLIT_HAZARD_TILE_HOST) ||
    sourceId.startsWith("hazard-")
  ) {
    return {
      severity: "overlay",
      message: "ハザードマップの取得に失敗しました。時間をおいて再試行してください。",
    }
  }

  return {
    severity: "fatal",
    message,
  }
}
