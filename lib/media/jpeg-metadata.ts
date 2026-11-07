// =============================================
// JPEG のメタデータ(Exif / XMP)を読む純粋ロジック(依存なし)
// - Exif の IFD0 の値(写真の向きなど)を読む
// - 撮影時の情報(位置情報・カメラの機種)が入っているかを調べる
// アプリが canvas で描き直した JPEG には、どちらも入らない。
// =============================================

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])
const u32le = (b: Uint8Array, i: number) => u16le(b, i) + u16le(b, i + 2) * 65536

function startsWithAscii(b: Uint8Array, start: number, end: number, text: string): boolean {
  if (start + text.length > end) return false
  for (let k = 0; k < text.length; k += 1) if (b[start + k] !== text.charCodeAt(k)) return false
  return true
}

function includesAscii(b: Uint8Array, start: number, end: number, text: string): boolean {
  const first = text.charCodeAt(0)
  for (let i = start; i + text.length <= end; i += 1) {
    if (b[i] === first && startsWithAscii(b, i, end, text)) return true
  }
  return false
}

interface Ifd0 {
  readonly little: boolean
  /** tag → エントリの位置 */
  readonly entries: ReadonlyMap<number, number>
}

/**
 * APP1 の中身("Exif\0\0" + TIFF)の IFD0 を読む。
 * Exif でなければ "not-exif"、Exif なのに形が壊れていて読めなければ "unreadable"。
 */
function readIfd0(b: Uint8Array, start: number, end: number): Ifd0 | "not-exif" | "unreadable" {
  if (!startsWithAscii(b, start, end, "Exif") || b[start + 4] !== 0 || b[start + 5] !== 0) return "not-exif"
  const tiff = start + 6
  if (tiff + 8 > end) return "unreadable"
  const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49
  if (!little && !(b[tiff] === 0x4d && b[tiff + 1] === 0x4d)) return "unreadable"
  const u16 = (i: number) => (little ? u16le(b, i) : u16be(b, i))
  const u32 = (i: number) => (little ? u32le(b, i) : u32be(b, i))
  if (u16(tiff + 2) !== 42) return "unreadable"
  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > end) return "unreadable"
  const count = u16(ifd)
  const entries = new Map<number, number>()
  for (let k = 0; k < count; k += 1) {
    const offset = ifd + 2 + k * 12
    if (offset + 12 > end) return "unreadable"
    entries.set(u16(offset), offset)
  }
  return { little, entries }
}

/** Exif の IFD0 にある SHORT の値(例: 向き 0x0112)。無い・読めないときは null。 */
export function exifIfd0Short(b: Uint8Array, start: number, end: number, tag: number): number | null {
  const ifd = readIfd0(b, start, end)
  if (typeof ifd === "string") return null
  const offset = ifd.entries.get(tag)
  if (offset === undefined) return null
  return ifd.little ? u16le(b, offset + 8) : u16be(b, offset + 8)
}

/** 撮影時の情報を指す Exif のタグ: GPS の場所・カメラのメーカー・機種。 */
const CAMERA_TAGS = [0x8825, 0x010f, 0x0110]
const XMP_HEADERS = ["http://ns.adobe.com/xap/1.0/", "http://ns.adobe.com/xmp/extension/"]
const XMP_CAMERA_WORDS = ["GPSLatitude", "GPSLongitude", "tiff:Make", "tiff:Model"]

/**
 * JPEG に撮影時の情報(Exif の GPS・カメラの機種、XMP の同じ項目)が入っているか。
 * canvas で描き直した写真には入らないので、入っていればぼかしを通っていない元の写真の疑いがある。
 * 画像データ(SOS)より前のメタデータだけを見る。形が壊れていて読めないときは、
 * 入っていないと言い切れないので true を返す(呼び出し側は保存しない)。
 */
export function jpegCarriesCameraMetadata(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return true
  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return true
    const marker = b[i + 1]
    if (marker === 0xff) {
      i += 1 // 詰め物の 0xFF
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xda || marker === 0xd9) return false
    const length = u16be(b, i + 2)
    const start = i + 4
    const end = i + 2 + length
    if (length < 2 || end > b.length) return true
    if (marker === 0xe1) {
      const ifd = readIfd0(b, start, end)
      if (ifd === "unreadable") return true
      if (typeof ifd !== "string" && CAMERA_TAGS.some((tag) => ifd.entries.has(tag))) return true
      const isXmp = XMP_HEADERS.some((header) => startsWithAscii(b, start, end, header))
      if (isXmp && XMP_CAMERA_WORDS.some((word) => includesAscii(b, start, end, word))) return true
    }
    i = end
  }
  return true
}
