/**
 * AR表示改善のためのユーティリティ関数
 * - カテゴリの日本語化
 * - 危険度表示の改善
 * - 不要情報の整理
 */

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
    other: "その他",
  }

  return translations[type] || type
}

/**
 * 危険度レベルを日本語ラベルに変換
 * @param level 危険度レベル（1-5）
 * @returns 日本語の危険度ラベル
 */
export function getDangerLevelLabel(level: number): string {
  if (level <= 1) {
    return "低リスク"
  }
  if (level === 2) {
    return "やや注意"
  }
  if (level === 3) {
    return "注意"
  }
  if (level === 4) {
    return "危険"
  }
  // level >= 5
  return "非常に危険"
}

/**
 * 危険度レベルに応じた色を返す
 * @param level 危険度レベル（1-5）
 * @returns カラーコード
 */
export function getDangerLevelColor(level: number): string {
  if (level <= 1) {
    return "#22c55e" // 緑
  }
  if (level === 2) {
    return "#f59e0b" // 黄色
  }
  if (level === 3) {
    return "#ef4444" // 赤
  }
  if (level === 4) {
    return "#dc2626" // 濃い赤
  }
  // level >= 5
  return "#991b1b" // 非常に濃い赤
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
