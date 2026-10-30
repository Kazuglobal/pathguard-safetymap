import { describe, expect, it } from 'vitest'
import { OpenLocationCode } from 'open-location-code'
import { buildGoogleMapsEmbedUrls } from '@/lib/google-maps-embed'

describe('Google Maps Embed URLs', () => {
  it('encodes the accident as an 11-digit Plus Code and preserves longitude/latitude order', () => {
    const urls = buildGoogleMapsEmbedUrls([139.767125, 35.681236], 'test-embed-key')!
    const map = new URL(urls.map)
    expect(map.origin + map.pathname).toBe('https://www.google.com/maps/embed/v1/place')
    const code = map.searchParams.get('q')!
    expect(code.replace('+', '')).toHaveLength(11)
    expect(urls.map).toContain('%2B')
    const area = new OpenLocationCode().decode(code)
    expect(area.latitudeLo).toBeLessThanOrEqual(35.681236)
    expect(area.latitudeHi).toBeGreaterThan(35.681236)
    expect(area.longitudeLo).toBeLessThanOrEqual(139.767125)
    expect(area.longitudeHi).toBeGreaterThanOrEqual(139.767125)
    expect(map.searchParams.get('center')).toBe('35.681236,139.767125')
    expect(map.searchParams.get('zoom')).toBe('18')
    expect(map.searchParams.get('language')).toBe('ja')
    expect(map.searchParams.get('key')).toBe('test-embed-key')
    const street = new URL(urls.streetView)
    expect(street.origin + street.pathname).toBe('https://www.google.com/maps/embed/v1/streetview')
    expect(street.searchParams.get('location')).toBe('35.681236,139.767125')
    expect(street.searchParams.get('radius')).toBe('50')
    expect(street.searchParams.get('source')).toBe('outdoor')
    expect(street.searchParams.has('heading')).toBe(false)
  })

  it('does not create requests without a dedicated key or valid coordinates', () => {
    for (const key of ['', '   ', undefined]) {
      expect(buildGoogleMapsEmbedUrls([139, 35], key)).toBeNull()
    }
    for (const coords of [[139, NaN], [Infinity, 35], [139, 91], [181, 35]]) {
      expect(buildGoogleMapsEmbedUrls(coords as [number, number], 'test-key')).toBeNull()
    }
  })
})
