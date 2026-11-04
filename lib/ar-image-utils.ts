/**
 * AR画像ユーティリティ関数
 * 登録された画像をARで表示するための機能
 */

import type { DangerReport } from "./types"

/**
 * 許可された画像ホストのリスト
 * セキュリティのため、信頼できるソースからの画像のみを許可
 */
const ALLOWED_IMAGE_HOSTS = [
  // Supabase Storage
  "supabase.co",
  "supabase.in",
  // 開発環境
  "localhost",
  "127.0.0.1",
]

/**
 * 画像URLが安全かどうかを検証する
 * @param url 検証するURL
 * @returns 安全なURLならtrue
 */
export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false
  }

  const trimmedUrl = url.trim()
  if (trimmedUrl === "") {
    return false
  }

  // 危険なプロトコルを拒否
  const lowerUrl = trimmedUrl.toLowerCase()
  if (
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("data:text/html") ||
    lowerUrl.startsWith("vbscript:") ||
    lowerUrl.startsWith("file:")
  ) {
    return false
  }

  // HTTPSまたはHTTPのみ許可（data:image/は画像として許可）
  if (
    !lowerUrl.startsWith("https://") &&
    !lowerUrl.startsWith("http://") &&
    !lowerUrl.startsWith("data:image/")
  ) {
    return false
  }

  // data:image/の場合は許可（Base64画像）
  if (lowerUrl.startsWith("data:image/")) {
    return true
  }

  // URLをパースしてホストを確認
  try {
    const parsedUrl = new URL(trimmedUrl)
    const hostname = parsedUrl.hostname.toLowerCase()

    // 許可されたホストか確認
    return ALLOWED_IMAGE_HOSTS.some(
      (allowedHost) =>
        hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
    )
  } catch {
    // 無効なURL
    return false
  }
}

/**
 * レポートから全ての画像URLを取得する
 * image_url と processed_image_urls を結合し、重複と空文字列を除去する
 * セキュリティ: 許可されたホストからの画像のみを返す
 * @param report 危険報告
 * @returns 画像URLの配列（重複なし、検証済み）
 */
export type ARImageKind = "original" | "processed"

export interface ARReportImage {
  url: string
  /** 加工画像は生成AIで作られる。元の写真と区別して表示する。 */
  kind: ARImageKind
}

/**
 * ARで表示する画像を、元の写真と加工画像の区別つきで返す。
 * 同じURLが両方に現れた場合は、先に現れた区分を保つ。
 */
export function getReportImageEntries(report: DangerReport): ARReportImage[] {
  const entries: ARReportImage[] = []
  const seen = new Set<string>()
  const push = (url: string | null | undefined, kind: ARImageKind) => {
    if (!url || !isValidImageUrl(url) || seen.has(url)) return
    seen.add(url)
    entries.push({ url, kind })
  }

  push(report.image_url, "original")
  // DBには単数形カラムも存在するため、両方を読み取る
  push(report.processed_image_url, "processed")
  if (Array.isArray(report.processed_image_urls)) {
    for (const url of report.processed_image_urls) push(url, "processed")
  }

  return entries
}

export function getReportImages(report: DangerReport): string[] {
  return getReportImageEntries(report).map((entry) => entry.url)
}


/**
 * 複数のレポートから全ての画像を取得する
 * @param reports 危険報告の配列
 * @returns レポートIDと画像URLの配列
 */
export function getAllReportImages(
  reports: DangerReport[]
): { reportId: string; images: string[] }[] {
  return reports.map((report) => ({
    reportId: report.id,
    images: getReportImages(report),
  }))
}

/**
 * レポートに複数の画像があるかどうかを判定する
 * @param report 危険報告
 * @returns 複数の画像があればtrue
 */
export function hasMultipleImages(report: DangerReport): boolean {
  return getReportImages(report).length > 1
}

/**
 * レポートの画像数を取得する
 * @param report 危険報告
 * @returns 画像の数
 */
export function getImageCount(report: DangerReport): number {
  return getReportImages(report).length
}
