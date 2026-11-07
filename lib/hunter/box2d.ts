// =============================================
// きけんハンター Gemini ネイティブ座標の変換 (純粋ロジック)
// Gemini は物体の位置を box_2d = [ymin, xmin, ymax, xmax](0〜1000)で返すよう学習されている。
// 0〜1 の {x,y,w,h} を指示するより位置がずれにくいため、こちらで受けて正規化座標へ直す。
//  - focus = [y, x](0〜1000)は「いちばん見るべき 1 点」。
//  - 0〜1 で返ってきた値・min/max の入れ違い・入れ子の配列・JSON 文字列も読む。
//  - 負の値・1000 超は推測で直さず null(後段の安全側フィルタに任せる)。
// イミュータブル: 入力は変更しない。
// =============================================

export interface NormalizedBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface NormalizedPoint {
  readonly x: number
  readonly y: number
}

/** 0〜1 の値とみなす上限(これ以下だけなら 0〜1、超えるものがあれば 0〜1000)。 */
const UNIT_SCALE_MAX = 1.5
const NATIVE_SCALE = 1000

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** 配列・入れ子の配列・JSON 文字列から数値の並びを取り出す。取り出せなければ null。 */
function toNumberList(value: unknown, length: number): number[] | null {
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
  const nums = raw.map(toNumber)
  return nums.every((n): n is number => n !== null) ? nums : null
}

/** 値の並びから割る数を決める。負・1000 超は null。 */
export function detectScale(values: readonly number[]): number | null {
  if (values.some((v) => v < 0 || v > NATIVE_SCALE)) return null
  return values.every((v) => v <= UNIT_SCALE_MAX) ? 1 : NATIVE_SCALE
}

/**
 * box_2d [ymin, xmin, ymax, xmax] → 正規化 {x,y,w,h} と、使った割る数。
 * 読めない・範囲外は null。
 */
export function box2dToRegion(value: unknown): { region: NormalizedBox; scale: number } | null {
  const nums = toNumberList(value, 4)
  if (!nums) return null
  const scale = detectScale(nums)
  if (scale === null) return null
  const [a, b, c, d] = nums.map((n) => n / scale)
  const y0 = Math.min(a, c)
  const y1 = Math.max(a, c)
  const x0 = Math.min(b, d)
  const x1 = Math.max(b, d)
  return { region: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, scale }
}

/**
 * focus [y, x] → 正規化の点。scale を渡せば box と同じ割る数を使う(片方の値が小さくても取り違えない)。
 * 読めない・範囲外は null。
 */
export function focusToPoint(value: unknown, scale?: number | null): NormalizedPoint | null {
  const nums = toNumberList(value, 2)
  if (!nums) return null
  const own = detectScale(nums)
  if (own === null) return null
  const divisor = scale ?? own
  const [y, x] = nums.map((n) => n / divisor)
  if (x > 1 || y > 1) return null
  return { x, y }
}

/**
 * 生の点(dangerPoint / safePoint)に box_2d があれば region と focus を正規化座標で入れ直す。
 * box_2d が読めない・無いときは元のまま返す(旧形式 region の救済は salvageRegionScale が担う)。
 */
export function normalizeNativeCoords(point: unknown): unknown {
  if (typeof point !== "object" || point === null) return point
  const p = point as Record<string, unknown>
  const box = "box_2d" in p ? box2dToRegion(p.box_2d) : null
  const focusScale = box ? box.scale : null
  const focus = "focus" in p ? focusToPoint(p.focus, focusScale) : null
  if (!box && !focus) return point
  return {
    ...p,
    ...(box ? { region: box.region } : {}),
    focus: focus ?? undefined,
  }
}
