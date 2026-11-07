// =============================================
// ピクセル座標 → 正規化座標 (純粋ロジック)
// Claude はピクセル座標([x1, y1, x2, y2] / [x, y])で位置を答えるのがいちばん正確
// (公式「Coordinates and bounding boxes」: 0〜1000 などの正規化座標は苦手)。
// アプリ内は 0..1 の正規化座標なので、Claude が見た画像の大きさで割って直す。
//  - 配列 / 入れ子の配列 / JSON 文字列 / {x1,y1,x2,y2} を読む。min/max の入れ違いは直す。
//  - 画像の外へはみ出た値は画像の端へ寄せる。読めない・負の値は null(推測で直さない)。
// =============================================

import type { ImageSize } from "@/lib/vision/image-size"

export interface NormalizedRegion {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** 配列・入れ子の配列・JSON 文字列から長さ length の数値の並びを取り出す。 */
function numberList(value: unknown, length: number): number[] | null {
  let raw: unknown = value
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0])) raw = raw[0]
  if (!Array.isArray(raw) || raw.length !== length) return null
  const nums = raw.map(num)
  return nums.every((n): n is number => n !== null) ? nums : null
}

const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max)

/** [x1, y1, x2, y2](ピクセル)または {x1,y1,x2,y2} → 正規化 {x,y,w,h}。 */
export function pixelBoxToRegion(value: unknown, size: ImageSize): NormalizedRegion | null {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  const nums = obj ? [num(obj.x1), num(obj.y1), num(obj.x2), num(obj.y2)] : numberList(value, 4)
  if (!nums || nums.some((n) => n === null)) return null
  const [a, b, c, d] = nums as number[]
  if ([a, b, c, d].some((n) => n < 0)) return null
  const x0 = clamp(Math.min(a, c), size.width)
  const x1 = clamp(Math.max(a, c), size.width)
  const y0 = clamp(Math.min(b, d), size.height)
  const y1 = clamp(Math.max(b, d), size.height)
  return { x: x0 / size.width, y: y0 / size.height, w: (x1 - x0) / size.width, h: (y1 - y0) / size.height }
}

/** [x, y](ピクセル)→ 正規化の点。 */
export function pixelPointToNormalized(value: unknown, size: ImageSize): { x: number; y: number } | null {
  const nums = numberList(value, 2)
  if (!nums || nums.some((n) => n < 0)) return null
  return { x: clamp(nums[0], size.width) / size.width, y: clamp(nums[1], size.height) / size.height }
}
