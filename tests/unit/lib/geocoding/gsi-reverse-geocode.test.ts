// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import municipalities from '@/lib/geocoding/gsi-municipalities.json'
import {
  lookupGsiMunicipality,
  reverseGeocodeGsi,
  withGsiAddressFallback,
} from '@/lib/geocoding/gsi-reverse-geocode'
import type { CreateDangerReportInput } from '@/lib/db/repos/danger-reports.repo'
import { ALL_PREFECTURES } from '@/lib/user-region'

const gsiResponse = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

const baseInput: CreateDangerReportInput = {
  title: 'ブロック塀', dangerType: 'disaster', dangerLevel: 3, latitude: 35.9128, longitude: 139.9568,
}

describe('lookupGsiMunicipality', () => {
  it('uses the same prefecture names as the region filter', () => {
    const prefectures = new Set(Object.values(municipalities as Record<string, string[]>).map(([p]) => p))
    expect([...prefectures].sort()).toEqual([...ALL_PREFECTURES].sort())
  })

  it('accepts codes with or without the leading zero', () => {
    expect(lookupGsiMunicipality('2203')).toEqual({
      prefecture: '青森県', prefectureCode: 2, city: '八戸市', municipalityCode: '02203',
    })
    expect(lookupGsiMunicipality('02203')?.city).toBe('八戸市')
  })

  it('joins designated-city wards without the full-width space', () => {
    expect(lookupGsiMunicipality('01101')?.city).toBe('札幌市中央区')
  })

  it('returns null for unknown or malformed codes', () => {
    expect(lookupGsiMunicipality('99999')).toBeNull()
    expect(lookupGsiMunicipality('12a17')).toBeNull()
  })
})

describe('reverseGeocodeGsi', () => {
  it('sends coordinates rounded to about 100m and maps the code to names', async () => {
    const fetchImpl = gsiResponse({ results: { muniCd: '12217', lv01Nm: '大室' } })
    const address = await reverseGeocodeGsi(35.912821, 139.956784, { fetchImpl })
    expect(address).toEqual({ prefecture: '千葉県', prefectureCode: 12, city: '柏市', municipalityCode: '12217' })
    const url = new URL(fetchImpl.mock.calls[0][0] as string)
    expect(url.searchParams.get('lat')).toBe('35.913')
    expect(url.searchParams.get('lon')).toBe('139.957')
  })

  it('returns null outside Japan, on HTTP errors and on network failure', async () => {
    expect(await reverseGeocodeGsi(1, 1, { fetchImpl: gsiResponse({ results: null }) })).toBeNull()
    expect(await reverseGeocodeGsi(35, 139, { fetchImpl: gsiResponse({}, 503) })).toBeNull()
    expect(await reverseGeocodeGsi(35, 139, { fetchImpl: vi.fn().mockRejectedValue(new Error('down')) })).toBeNull()
  })

  it('gives up when the service does not answer in time', async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    }))
    expect(await reverseGeocodeGsi(35, 139, { fetchImpl: hang as unknown as typeof fetch, timeoutMs: 10 })).toBeNull()
  })

  it('returns null when the service answers with broken JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))
    expect(await reverseGeocodeGsi(35, 139, { fetchImpl })).toBeNull()
  })

  it('does not call the service for invalid coordinates', async () => {
    const fetchImpl = gsiResponse({ results: { muniCd: '12217' } })
    expect(await reverseGeocodeGsi(Number.NaN, 139, { fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('withGsiAddressFallback', () => {
  it('fills the address when the browser could not', async () => {
    const result = await withGsiAddressFallback(
      { ...baseInput, prefecture: null, city: null },
      { fetchImpl: gsiResponse({ results: { muniCd: '12217' } }) },
    )
    expect(result).toMatchObject({
      prefecture: '千葉県', prefectureCode: 12, city: '柏市', municipalityCode: '12217', geocodeSource: 'gsi',
    })
    expect(result.geocodedAt).toEqual(expect.any(String))
  })

  it('keeps an address the browser already resolved', async () => {
    const fetchImpl = gsiResponse({ results: { muniCd: '12217' } })
    const input = { ...baseInput, prefecture: '千葉県', city: '柏市' }
    expect(await withGsiAddressFallback(input, { fetchImpl })).toBe(input)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('leaves the input unchanged when the lookup fails', async () => {
    const input = { ...baseInput, prefecture: '' }
    expect(await withGsiAddressFallback(input, { fetchImpl: gsiResponse({}, 500) })).toBe(input)
  })
})
