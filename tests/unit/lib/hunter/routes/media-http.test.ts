// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { stripWebpMetadata, allowedWorldAsset, cacheWorldSplat } from '@/lib/hunter/routes/media'
import { readRouteJson, requireSameOrigin } from '@/lib/hunter/routes/http'

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: vi.fn() }))

function chunk(tag: string, bytes: Buffer) {
  const header = Buffer.alloc(8); header.write(tag); header.writeUInt32LE(bytes.length, 4)
  return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)])
}
function webp(chunks: Buffer[]) {
  const payload = Buffer.concat([Buffer.from('WEBP'), ...chunks])
  const header = Buffer.alloc(8); header.write('RIFF'); header.writeUInt32LE(payload.length, 4)
  return `data:image/webp;base64,${Buffer.concat([header, payload]).toString('base64')}`
}
describe('private route image boundaries', () => {
  it('removes all identifying metadata and repairs the WebP feature flags and RIFF size', () => {
    const extended = Buffer.alloc(10); extended[0] = 0x3c
    const source = webp([chunk('VP8X', extended), chunk('EXIF', Buffer.from('precise-location')), chunk('ICCP', Buffer.from('profile')), chunk('VP8 ', Buffer.from([1, 2, 3])), chunk('XMP ', Buffer.from('name'))])
    const result = Buffer.from(stripWebpMetadata(source))
    expect(result.includes(Buffer.from('precise-location'))).toBe(false)
    expect(result.includes(Buffer.from('EXIF'))).toBe(false)
    expect(result.includes(Buffer.from('XMP '))).toBe(false)
    expect(result.includes(Buffer.from('ICCP'))).toBe(false)
    expect(result[20]).toBe(0x10)
    expect(result.readUInt32LE(4) + 8).toBe(result.length)
    expect(result.includes(Buffer.from([1, 2, 3]))).toBe(true)
  })
  it('rejects disguised images, truncated chunks and animation-only images', () => {
    expect(() => stripWebpMetadata('data:image/svg+xml;base64,PHN2Zz4=')).toThrow()
    expect(() => stripWebpMetadata(webp([chunk('ANMF', Buffer.from([1, 2]))]))).toThrow()
    const bad = chunk('VP8 ', Buffer.from([1])); bad.writeUInt32LE(1000, 4)
    expect(() => stripWebpMetadata(webp([bad]))).toThrow()
  })
  it('only accepts HTTPS asset hosts without credentials or alternate ports', () => {
    expect(allowedWorldAsset('https://storage.googleapis.com/assets/scene.spz')).toBe(true)
    expect(allowedWorldAsset('https://cdn.worldlabs.ai/assets/scene.spz')).toBe(true)
    for (const url of ['http://storage.googleapis.com/a', 'https://storage.googleapis.com.attacker.test/a', 'https://attackerworldlabs.ai/a', 'https://user@storage.googleapis.com/a', 'https://storage.googleapis.com:444/a', 'http://127.0.0.1/a']) expect(allowedWorldAsset(url)).toBe(false)
  })
  it('rejects untrusted asset URLs before making a network request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(cacheWorldSplat('http://127.0.0.1/private', 'scene')).rejects.toMatchObject({ code: 'asset_host' })
    expect(fetchMock).not.toHaveBeenCalled(); fetchMock.mockRestore()
  })
})

describe('route request boundaries', () => {
  it('rejects cross-site mutations including requests without Origin', () => {
    expect(() => requireSameOrigin(new Request('https://school.test/api', { headers: { origin: 'https://other.test' } }))).toThrow()
    expect(() => requireSameOrigin(new Request('https://school.test/api', { headers: { 'sec-fetch-site': 'cross-site' } }))).toThrow()
    expect(() => requireSameOrigin(new Request('https://school.test/api', { headers: { origin: 'https://school.test' } }))).not.toThrow()
  })
  it('cancels an oversized streamed body by byte count even without Content-Length', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('あ'.repeat(10))) }, cancel })
    const request = new Request('https://school.test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit)
    await expect(readRouteJson(request, 20)).rejects.toMatchObject({ status: 413 })
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('parses valid JSON and rejects other content types and malformed JSON', async () => {
    const request = (body: string, type = 'application/json') => new Request('https://school.test/api', { method: 'POST', headers: { 'content-type': type }, body })
    await expect(readRouteJson(request('{"name":"学校"}'))).resolves.toEqual({ name: '学校' })
    await expect(readRouteJson(request('broken'))).rejects.toMatchObject({ status: 400 })
    await expect(readRouteJson(request('{}', 'text/plain'))).rejects.toMatchObject({ status: 415 })
  })
})
