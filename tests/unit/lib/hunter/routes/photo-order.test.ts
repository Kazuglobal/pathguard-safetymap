// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readPhotoGps, suggestPhotoOrder } from '@/lib/hunter/routes/photo-order'

function jpeg(little: boolean, latRef = 'N', longRef = 'E', corrupt = false) {
  const tiff = new Uint8Array(128); const view = new DataView(tiff.buffer)
  const short = (at: number, n: number) => view.setUint16(at, n, little)
  const long = (at: number, n: number) => view.setUint32(at, n, little)
  tiff.set(little ? [0x49, 0x49] : [0x4d, 0x4d]); short(2, 42); long(4, 8)
  short(8, 1); short(10, 0x8825); short(12, 4); long(14, 1); long(18, corrupt ? 999999 : 26)
  short(26, 4)
  for (const [at, tag, type, count, data] of [[28, 1, 2, 2, 0], [40, 2, 5, 3, 80], [52, 3, 2, 2, 0], [64, 4, 5, 3, 104]]) {
    short(at, tag); short(at + 2, type); long(at + 4, count); long(at + 8, data)
  }
  tiff[36] = latRef.charCodeAt(0); tiff[60] = longRef.charCodeAt(0)
  for (const [at, degree] of [[80, 35], [104, 139]]) { long(at, degree); long(at + 4, 1); long(at + 8, 30); long(at + 12, 1); long(at + 16, 0); long(at + 20, 1) }
  const prefix = new Uint8Array([255, 216, 255, 225, 0, tiff.length + 8, 69, 120, 105, 102, 0, 0])
  return new Blob([prefix, tiff, new Uint8Array([255, 217])])
}
describe('photo GPS extraction and route order', () => {
  it.each([true, false])('reads both TIFF byte orders (little endian: %s)', async little => {
    await expect(readPhotoGps(jpeg(little))).resolves.toEqual({ latitude: 35.5, longitude: 139.5 })
    await expect(readPhotoGps(jpeg(little, 'S', 'W'))).resolves.toEqual({ latitude: -35.5, longitude: -139.5 })
  })
  it('ignores invalid offsets, directions and non-JPEG data without throwing', async () => {
    await expect(readPhotoGps(jpeg(true, 'N', 'E', true))).resolves.toBeNull()
    await expect(readPhotoGps(jpeg(true, '?', 'E'))).resolves.toBeNull()
    await expect(readPhotoGps(new Blob(['not an image']))).resolves.toBeNull()
    await expect(readPhotoGps(jpeg(true).slice(0, 40))).resolves.toBeNull()
  })
  it('reads only the bounded header instead of loading an entire large image', async () => {
    let requested = 0
    const file = { slice: (_start: number, end: number) => { requested = end; return new Blob() } } as Blob
    expect(await readPhotoGps(file)).toBeNull(); expect(requested).toBe(262144)
  })
  it('keeps the first GPS photo as start and stable ties, leaving unknown positions at the end', () => {
    const item = (id: string, longitude?: number) => ({ id, gps: longitude === undefined ? null : { latitude: 35, longitude } })
    const photos = [item('unknown'), item('start', 139), item('far', 139.02), item('near', 139.001), item('tie', 139.001), item('last')]
    expect(suggestPhotoOrder(photos).map(p => p.id)).toEqual(['start', 'near', 'tie', 'far', 'unknown', 'last'])
    expect(photos.map(p => p.id)).toEqual(['unknown', 'start', 'far', 'near', 'tie', 'last'])
  })
  it('preserves the original sequence when there are not enough valid positions', () => {
    const photos = [{ id: 'bad', gps: { latitude: NaN, longitude: 10 } }, { id: 'one', gps: { latitude: 35, longitude: 139 } }]
    expect(suggestPhotoOrder(photos)).toEqual(photos)
  })
})
