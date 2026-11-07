// =============================================
// JPEG のメタデータ(Exif / XMP)を読む純粋ロジック(依存なし)
// - Exif の IFD0 の値(写真の向きなど)を読む
// - 位置情報(Exif の GPS・XMP の GPS)が入っているかを調べる
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

/** APP1 の中身("Exif\0\0" + TIFF)の IFD0 で tag のエントリを探す。無い・読めないときは null。 */
function findIfd0Entry(b: Uint8Array, start: number, end: number, tag: number): { offset: number; little: boolean } | null {
  if (!startsWithAscii(b, start, end, "Exif") || b[start + 4] !== 0 || b[start + 5] !== 0) return null
  const tiff = start + 6
  if (tiff + 8 > end) return null
  const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49
  if (!little && !(b[tiff] === 0x4d && b[tiff + 1] === 0x4d)) return null
  const u16 = (i: number) => (little ? u16le(b, i) : u16be(b, i))
  const u32 = (i: number) => (little ? u32le(b, i) : u32be(b, i))
  if (u16(tiff + 2) !== 42) return null
  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > end) return null
  const entries = u16(ifd)
  for (let k = 0; k < entries; k += 1) {
    const offset = ifd + 2 + k * 12
    if (offset + 12 > end) return null
    if (u16(offset) === tag) return { offset, little }
  }
  return null
}

/** Exif の IFD0 にある SHORT の値(例: 向き 0x0112)。無い・読めないときは null。 */
export function exifIfd0Short(b: Uint8Array, start: number, end: number, tag: number): number | null {
  const entry = findIfd0Entry(b, start, end, tag)
  if (!entry) return null
  return entry.little ? u16le(b, entry.offset + 8) : u16be(b, entry.offset + 8)
}

/** Exif の GPS 情報の場所を指すタグ。 */
const GPS_IFD_POINTER = 0x8825
const XMP_HEADERS = ["http://ns.adobe.com/xap/1.0/", "http://ns.adobe.com/xmp/extension/"]

/**
 * JPEG に位置情報が入っているか(Exif の GPS、または XMP の GPSLatitude / GPSLongitude)。
 * 画像データ(SOS)より前のメタデータだけを見る。形が壊れていて最後まで読めないときは、
 * 入っていないと言い切れないので true を返す(呼び出し側は保存しない)。
 */
export function jpegCarriesLocation(b: Uint8Array): boolean {
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
      if (findIfd0Entry(b, start, end, GPS_IFD_POINTER)) return true
      const isXmp = XMP_HEADERS.some((header) => startsWithAscii(b, start, end, header))
      if (isXmp && (includesAscii(b, start, end, "GPSLatitude") || includesAscii(b, start, end, "GPSLongitude"))) return true
    }
    i = end
  }
  return true
}
