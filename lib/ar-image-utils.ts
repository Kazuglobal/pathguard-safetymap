/**
 * AR画像ユーティリティ関数
 * 登録された画像をARで表示するための機能
 */

import type { DangerReport } from "./types"

/**
 * レポートから全ての画像URLを取得する
 * image_url と processed_image_urls を結合し、重複と空文字列を除去する
 * @param report 危険報告
 * @returns 画像URLの配列（重複なし）
 */
export function getReportImages(report: DangerReport): string[] {
  const images: string[] = []

  // image_url があれば追加
  if (report.image_url && report.image_url.trim() !== "") {
    images.push(report.image_url)
  }

  // processed_image_urls があれば追加
  if (report.processed_image_urls && Array.isArray(report.processed_image_urls)) {
    for (const url of report.processed_image_urls) {
      if (url && url.trim() !== "") {
        images.push(url)
      }
    }
  }

  // 重複を除去して返す
  return [...new Set(images)]
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
