// =============================================
// 画像のピクセルサイズ (純粋ロジック・依存なし)
// Claude は「ピクセル座標」で位置を答えるのがいちばん正確なので、送る画像の幅・高さが要る。
// data URL / base64 の先頭だけを読んで PNG / JPEG / WebP / GIF のサイズを返す(画像全体は復号しない)。
// あわせて、Claude が画像を縮小する規則(公式の参照実装と同じ)で「Claude が見る大きさ」を出す。
// =============================================

export interface ImageSize {
  readonly width: number
  readonly height: number
}

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp"

export interface ParsedImageDataUrl {
  readonly mediaType: ImageMediaType
  readonly base64: string
}

const SUPPORTED: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

/** data URL を mediaType と base64 に分ける(Claude が受け付ける形式だけ)。 */
export function parseImageDataUrl(value: string): ParsedImageDataUrl | null {
  if (!value.startsWith("data:")) return null
  const comma = value.indexOf(",")
  if (comma < 0) return null
  const header = value.slice(5, comma)
  const semicolon = header.indexOf(";")
  if (semicolon < 0 || !header.includes(";base64")) return null
  const mediaType = header.slice(0, semicolon).toLowerCase()
  if (!SUPPORTED.has(mediaType)) return null
  return { mediaType: mediaType as ImageMediaType, base64: value.slice(comma + 1) }
}

/** base64 の先頭 bytes だけを復号する(数 MB の画像でも先頭 64KB まで)。 */
function headBytes(base64: string, maxBytes = 65536): Uint8Array {
  const chars = Math.min(base64.length, Math.ceil(maxBytes / 3) * 4)
  const clean = base64.slice(0, chars - (chars % 4))
  const binary = typeof atob === "function" ? atob(clean) : Buffer.from(clean, "base64").toString("binary")
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])

function pngSize(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null
  return { width: u32be(b, 16), height: u32be(b, 20) }
}

function gifSize(b: Uint8Array): ImageSize | null {
  if (b.length < 10 || b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return null
  return { width: u16le(b, 6), height: u16le(b, 8) }
}

/** JPEG: SOF マーカー(C0〜CF、ただし C4/C8/CC を除く)の高さ・幅。 */
function jpegSize(b: Uint8Array): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const length = u16be(b, i + 2)
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) return { width: u16be(b, i + 7), height: u16be(b, i + 5) }
    i += 2 + length
  }
  return null
}

/** WebP: VP8 (lossy) / VP8L (lossless) / VP8X (拡張)。 */
function webpSize(b: Uint8Array): ImageSize | null {
  const tag = (i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3])
  if (b.length < 30 || tag(0) !== "RIFF" || tag(8) !== "WEBP") return null
  const chunk = tag(12)
  if (chunk === "VP8 ") return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff }
  if (chunk === "VP8L") {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 }
  return null
}

/** 画像の幅・高さ(読めない・0 以下なら null)。 */
export function readImageSize(image: ParsedImageDataUrl): ImageSize | null {
  let bytes: Uint8Array
  try {
    bytes = headBytes(image.base64)
  } catch {
    return null
  }
  const size =
    image.mediaType === "image/png"
      ? pngSize(bytes)
      : image.mediaType === "image/gif"
        ? gifSize(bytes)
        : image.mediaType === "image/webp"
          ? webpSize(bytes)
          : jpegSize(bytes)
  if (!size || !(size.width > 0) || !(size.height > 0)) return null
  return size
}

// ---- Claude が見る大きさ(公式「Coordinates and bounding boxes」の参照実装と同じ規則) ----

/** Claude 4.7 以降(Haiku 5.5 を含む)の高解像度の枠。 */
export const CLAUDE_HIGH_RES_LIMITS = { maxEdge: 2576, maxTokens: 4784 } as const
/** それより前のモデルの枠。 */
export const CLAUDE_STANDARD_LIMITS = { maxEdge: 1568, maxTokens: 1568 } as const

const PATCH = 28

function visualTokens(w: number, h: number): number {
  return Math.ceil(w / PATCH) * Math.ceil(h / PATCH)
}

/** 0.5 ちょうどは偶数へ(API と同じ丸め)。 */
function roundTiesToEven(value: number): number {
  const floor = Math.floor(value)
  if (value - floor !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

/**
 * Claude が画像を処理するときの大きさ(余白を足す前)。収まる画像はそのまま返す。
 * 返ってくるピクセル座標はこの大きさが基準なので、正規化はこの幅・高さで割る。
 */
export function claudeProcessedSize(
  size: ImageSize,
  limits: { maxEdge: number; maxTokens: number } = CLAUDE_HIGH_RES_LIMITS,
): ImageSize {
  const fits = (w: number, h: number) =>
    Math.ceil(w / PATCH) * PATCH <= limits.maxEdge &&
    Math.ceil(h / PATCH) * PATCH <= limits.maxEdge &&
    visualTokens(w, h) <= limits.maxTokens
  const { width, height } = size
  if (fits(width, height)) return size
  if (height > width) {
    const rotated = claudeProcessedSize({ width: height, height: width }, limits)
    return { width: rotated.height, height: rotated.width }
  }
  const aspect = width / height
  let lo = 1
  let hi = width
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fits(mid, Math.max(roundTiesToEven(mid / aspect), 1))) lo = mid
    else hi = mid
  }
  return { width: lo, height: Math.max(roundTiesToEven(lo / aspect), 1) }
}

/**
 * モデル名から画像の枠を決める。Claude 4.7 以降・5 世代は高解像度、それ以外は標準。
 * (アプリは写真を長い辺 1600px までに縮めて送るので、高解像度の枠ではそのまま収まる。)
 */
export function claudeImageLimits(model: string): { maxEdge: number; maxTokens: number } {
  const m = model.match(/claude-(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/)
  if (!m) return CLAUDE_STANDARD_LIMITS
  const major = Number(m[1])
  const minor = m[2] && m[2].length <= 2 ? Number(m[2]) : 0
  return major > 4 || (major === 4 && minor >= 7) ? CLAUDE_HIGH_RES_LIMITS : CLAUDE_STANDARD_LIMITS
}
