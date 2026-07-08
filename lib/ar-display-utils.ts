/**
 * AR表示改善のためのユーティリティ関数
 * - カテゴリの日本語化
 * - 危険度表示の改善
 * - 不要情報の整理
 *
 * 危険度の色・ラベルは danger-level-presentation.ts の一元定義に委譲する。
 * (かつてAR独自の5段階色・ラベルを持っていたが、画面ごとに表現が
 *  食い違う原因になったため廃止。独自定義を復活させないこと)
 */

import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"

/**
 * 危険タイプを日本語に変換
 * @param type 危険タイプ（英語）
 * @returns 日本語の危険タイプ
 */
export function translateDangerType(type: string | null | undefined): string {
  if (!type) {
    return "その他"
  }

  const translations: Record<string, string> = {
    disaster: "災害リスク",
    traffic: "交通危険",
    construction: "工事中",
    crime: "防犯注意",
    suspicious: "不審者情報",
    other: "その他",
  }

  return translations[type] || type
}

/**
 * 危険度レベルを日本語ラベルに変換
 * @param level 危険度レベル（データは1-5がありうる。表示は1-4にクランプ）
 * @returns 子ども向けの危険度ラベル(一元定義の kidLabel)
 */
export function getDangerLevelLabel(level: number): string {
  return getDangerLevelPresentation(level).kidLabel
}

/**
 * 危険度レベルに応じた色を返す
 * @param level 危険度レベル（データは1-5がありうる。表示は1-4にクランプ）
 * @returns カラーコード(一元定義の colorHex)
 */
export function getDangerLevelColor(level: number): string {
  return getDangerLevelPresentation(level).colorHex
}

/**
 * 6桁hex色コードをrgba形式に変換
 * @param hex 6桁hex色コード（例: "#ef4444"）
 * @param alpha 透明度（0-1）
 * @returns rgba文字列（例: "rgba(239, 68, 68, 0.8)"）
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalizedHex = hex.trim().replace(/^#/, "")
  const clampedAlpha = Math.max(0, Math.min(1, alpha))

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return `rgba(0, 0, 0, ${clampedAlpha})`
  }

  const r = Number.parseInt(normalizedHex.slice(0, 2), 16)
  const g = Number.parseInt(normalizedHex.slice(2, 4), 16)
  const b = Number.parseInt(normalizedHex.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`
}

/**
 * 方向（度数）を日本語の向き表示に変換
 * 精度情報(±XX°)は含めない
 * @param heading 方向（0-360度、0が北）
 * @returns 日本語の向き表示（例: "北向き"）
 */
export function formatHeadingDisplay(heading: number): string {
  // 角度を0-360の範囲に正規化
  let normalizedHeading = heading % 360
  if (normalizedHeading < 0) {
    normalizedHeading += 360
  }

  // 8方位で分類（各方位は45度の範囲）
  const directions = [
    { min: 337.5, max: 360, label: "北" },
    { min: 0, max: 22.5, label: "北" },
    { min: 22.5, max: 67.5, label: "北東" },
    { min: 67.5, max: 112.5, label: "東" },
    { min: 112.5, max: 157.5, label: "南東" },
    { min: 157.5, max: 202.5, label: "南" },
    { min: 202.5, max: 247.5, label: "南西" },
    { min: 247.5, max: 292.5, label: "西" },
    { min: 292.5, max: 337.5, label: "北西" },
  ]

  for (const dir of directions) {
    if (normalizedHeading >= dir.min && normalizedHeading < dir.max) {
      return `${dir.label}向き`
    }
  }

  // フォールバック（通常はここに到達しない）
  return "北向き"
}
