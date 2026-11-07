import { describe, expect, it } from "vitest"

import { exifIfd0Short, jpegCarriesLocation } from "@/lib/media/jpeg-metadata"

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]

/** canvas が書き出す形: JFIF(APP0)だけで、Exif も XMP も無い。 */
const APP0 = [0xff, 0xe0, ...be16(16), ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]
const SOS_AND_DATA = [0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9]

function jpeg(...segments: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), ...SOS_AND_DATA])
}

/** Exif(リトルエンディアン)の IFD0 に [tag, type, value] のエントリを並べた APP1。 */
function exifApp1(entries: Array<[number, number, number]>): number[] {
  const tiff = [
    ...ascii("II"), ...le16(42), ...le32(8),
    ...le16(entries.length),
    ...entries.flatMap(([tag, type, value]) => [...le16(tag), ...le16(type), ...le32(1), ...le32(value)]),
    ...le32(0),
  ]
  return [0xff, 0xe1, ...be16(2 + 6 + tiff.length), ...ascii("Exif"), 0, 0, ...tiff]
}

function xmpApp1(body: string): number[] {
  const payload = [...ascii("http://ns.adobe.com/xap/1.0/"), 0, ...ascii(body)]
  return [0xff, 0xe1, ...be16(2 + payload.length), ...payload]
}

describe("jpegCarriesLocation", () => {
  it("passes a canvas-made JPEG (JFIF only) and one whose Exif has no GPS", () => {
    expect(jpegCarriesLocation(jpeg(APP0))).toBe(false)
    expect(jpegCarriesLocation(jpeg(APP0, exifApp1([[0x0112, 3, 1]])))).toBe(false)
    expect(jpegCarriesLocation(jpeg(xmpApp1('<x:xmpmeta><rdf:Description xmp:CreatorTool="x"/></x:xmpmeta>')))).toBe(false)
  })

  it("finds GPS in Exif (a camera photo with location) and in XMP", () => {
    expect(jpegCarriesLocation(jpeg(APP0, exifApp1([[0x0112, 3, 1], [0x8825, 4, 128]])))).toBe(true)
    expect(jpegCarriesLocation(jpeg(xmpApp1('<rdf:Description exif:GPSLatitude="35,40.1N"/>')))).toBe(true)
  })

  it("refuses what it cannot read to the end of the metadata (not a JPEG, cut short)", () => {
    expect(jpegCarriesLocation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(true)
    expect(jpegCarriesLocation(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 1, 2]))).toBe(true)
  })
})

describe("exifIfd0Short", () => {
  it("reads a SHORT value from IFD0 and returns null when the tag is missing", () => {
    const app1 = exifApp1([[0x0112, 3, 6]])
    const bytes = new Uint8Array(app1)
    expect(exifIfd0Short(bytes, 4, bytes.length, 0x0112)).toBe(6)
    expect(exifIfd0Short(bytes, 4, bytes.length, 0x8825)).toBeNull()
  })
})
