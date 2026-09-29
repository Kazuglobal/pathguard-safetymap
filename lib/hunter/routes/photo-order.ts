export type PhotoGps = { latitude: number; longitude: number }

/** Read only the JPEG APP1 GPS IFD. Coordinates stay in the browser and are
 * discarded when the masked image is saved. Unsupported metadata returns null.
 * Tags follow CIPA DC-008: GPSInfoIFDPointer, Latitude/Ref, Longitude/Ref. */
export async function readPhotoGps(file: Blob): Promise<PhotoGps | null> {
  try {
    const bytes = new Uint8Array(await file.slice(0, 262_144).arrayBuffer())
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
    const view = new DataView(bytes.buffer)
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset] !== 0xff) return null
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xda || marker === 0xd9) return null
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const size = view.getUint16(offset)
      if (size < 2 || offset + size > bytes.length) return null
      if (marker === 0xe1 && size >= 16 && bytes[offset + 2] === 0x45 && bytes[offset + 3] === 0x78 && bytes[offset + 4] === 0x69 && bytes[offset + 5] === 0x66 && bytes[offset + 6] === 0 && bytes[offset + 7] === 0) {
        const base = offset + 8
        const tiff = new DataView(bytes.buffer, base, offset + size - base)
        const order = tiff.getUint16(0)
        if (order !== 0x4949 && order !== 0x4d4d) return null
        const little = order === 0x4949
        const u16 = (at: number) => tiff.getUint16(at, little)
        const u32 = (at: number) => tiff.getUint32(at, little)
        if (u16(2) !== 42) return null
        function entry(ifd: number, tag: number) {
          const count = u16(ifd)
          if (count > 512 || ifd + 2 + count * 12 + 4 > tiff.byteLength) return null
          for (let i = 0; i < count; i++) { const at = ifd + 2 + i * 12; if (u16(at) === tag) return at }
          return null
        }
        const pointer = entry(u32(4), 0x8825)
        if (pointer === null || u16(pointer + 2) !== 4 || u32(pointer + 4) !== 1) return null
        const gps = u32(pointer + 8)
        function coordinate(valueTag: number, refTag: number, positive: string, negative: string, max: number) {
          const value = entry(gps, valueTag); const ref = entry(gps, refTag)
          if (value === null || ref === null || u16(value + 2) !== 5 || u32(value + 4) !== 3 || u16(ref + 2) !== 2 || u32(ref + 4) !== 2) return null
          const direction = String.fromCharCode(tiff.getUint8(ref + 8))
          if (![positive, negative].includes(direction)) return null
          const data = u32(value + 8)
          const parts = [0, 8, 16].map(delta => u32(data + delta) / u32(data + delta + 4))
          if (parts.some(value => !Number.isFinite(value) || value < 0) || parts[1] >= 60 || parts[2] >= 60) return null
          const decimal = parts[0] + parts[1] / 60 + parts[2] / 3600
          return decimal <= max ? decimal * (direction === negative ? -1 : 1) : null
        }
        const latitude = coordinate(2, 1, 'N', 'S', 90)
        const longitude = coordinate(4, 3, 'E', 'W', 180)
        return latitude === null || longitude === null ? null : { latitude, longitude }
      }
      offset += size
    }
  } catch { /* No metadata is safer than guessing coordinates from broken bytes. */ }
  return null
}

function validGps(gps?: PhotoGps | null): gps is PhotoGps {
  return !!gps && Number.isFinite(gps.latitude) && Math.abs(gps.latitude) <= 90 && Number.isFinite(gps.longitude) && Math.abs(gps.longitude) <= 180
}
function distance(a: PhotoGps, b: PhotoGps) {
  const radians = Math.PI / 180
  return Math.sin((b.latitude - a.latitude) * radians / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin((b.longitude - a.longitude) * radians / 2) ** 2
}

/** A proximity suggestion, not road routing. Keep the first located photo as
 * the start, retain stable ties, and leave photos without GPS at the end. */
export function suggestPhotoOrder<T extends { gps?: PhotoGps | null }>(photos: readonly T[]): T[] {
  const remaining = photos.filter(photo => validGps(photo.gps))
  if (remaining.length < 2) return [...photos]
  const ordered = [remaining.shift()!]
  while (remaining.length) {
    const from = ordered.at(-1)!.gps!
    let nearest = 0
    for (let i = 1; i < remaining.length; i++) if (distance(from, remaining[i].gps!) < distance(from, remaining[nearest].gps!)) nearest = i
    ordered.push(remaining.splice(nearest, 1)[0])
  }
  return [...ordered, ...photos.filter(photo => !validGps(photo.gps))]
}
