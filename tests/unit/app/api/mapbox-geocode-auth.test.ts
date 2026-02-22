import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockGeocode,
  mockAutocomplete,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGeocode: vi.fn(),
  mockAutocomplete: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('@/lib/api-usage-logger', () => ({
  logApiUsage: vi.fn(),
}))

vi.mock('@/lib/geocoding/enhanced-geocoding', () => ({
  enhancedGeocodingService: {
    geocode: mockGeocode,
    autocomplete: mockAutocomplete,
    reverseGeocode: vi.fn(),
    smartSearch: vi.fn(),
    batchGeocode: vi.fn(),
    createSession: vi.fn(),
    getSearchSuggestions: vi.fn(),
    analyzeSearchPatterns: vi.fn(),
  },
}))

import { GET, POST } from '@/app/api/mapbox/geocode/route'

describe('mapbox geocode route auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGeocode.mockResolvedValue({ success: true, data: [] })
    mockAutocomplete.mockResolvedValue({ success: true, data: [] })
  })

  it('未認証ユーザーの GET は 401 を返す', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost/api/mapbox/geocode?query=tokyo')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Authentication required' })
  })

  it('未認証ユーザーの POST は 401 を返す', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost/api/mapbox/geocode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'autocomplete', query: 'tokyo' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Authentication required' })
  })
})
