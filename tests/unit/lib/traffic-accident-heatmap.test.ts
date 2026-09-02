import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_HEATMAP_FILTERS,
  fetchAccidentsInBounds,
  type AccidentGeoJSON,
} from '@/lib/traffic-accident-heatmap'

function createApiMock(
  impl: (url: string) => Promise<{ data: unknown; error: { message: string } | null; status?: number }>,
) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const result = await impl(String(input))
    return new Response(JSON.stringify(result.error ? { error: result.error.message } : result.data), {
      status: result.error ? (result.status ?? 500) : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { supabase: {} as any, fetchMock }
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>, index = 0): URL {
  return new URL(String(fetchMock.mock.calls[index][0]), 'http://localhost')
}

describe('traffic-accident-heatmap', () => {
  it('uses 2024 as the default max year for heatmap queries', () => {
    expect(DEFAULT_HEATMAP_FILTERS.maxYear).toBe(2024)
  })

  it('returns empty collection and skips API when bounds are invalid', async () => {
    const { supabase, fetchMock } = createApiMock(async () => ({ data: null, error: null }))

    const result = await fetchAccidentsInBounds(
      supabase,
      { minLng: 999, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes bounds and filter inputs before the D1 API call', async () => {
    const response: AccidentGeoJSON = { type: 'FeatureCollection', features: [] }
    const { supabase, fetchMock } = createApiMock(async () => ({ data: response, error: null }))

    await fetchAccidentsInBounds(
      supabase,
      { minLng: 140, minLat: 36, maxLng: 139, maxLat: 35 },
      {
        minYear: 2024,
        maxYear: 2020,
        severityFilter: 'all',
        childFilter: false,
        youngFilter: true,
        pedestrianFilter: true,
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = calledUrl(fetchMock)
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      minLng: '139',
      minLat: '35',
      maxLng: '140',
      maxLat: '36',
      minYear: '2020',
      maxYear: '2024',
      severity: 'all',
      young: 'true',
      pedestrian: 'true',
    })
    expect(url.searchParams.has('child')).toBe(false)
  })

  it('throws with a readable message when the API fails', async () => {
    const { supabase, fetchMock } = createApiMock(async () => ({
      data: null,
      error: { message: 'permission denied' },
      status: 403,
    }))

    await expect(fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )).rejects.toThrow('事故データの取得に失敗しました: permission denied')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns empty collection when the API returns malformed payload', async () => {
    const { supabase } = createApiMock(async () => ({ data: { foo: 'bar' }, error: null }))

    const result = await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
  })

  it('retries with a lower limit when D1 reports a statement timeout', async () => {
    const response: AccidentGeoJSON = { type: 'FeatureCollection', features: [] }
    const api = createApiMock(async () => api.fetchMock.mock.calls.length === 1
      ? { data: null, error: { message: 'statement timeout' }, status: 504 }
      : { data: response, error: null })

    const result = await fetchAccidentsInBounds(
      api.supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )

    expect(result).toEqual(response)
    expect(api.fetchMock).toHaveBeenCalledTimes(2)
    expect(calledUrl(api.fetchMock, 0).searchParams.get('limit')).toBe('10000')
    expect(calledUrl(api.fetchMock, 1).searchParams.get('limit')).toBe('5000')
  })

  it('uses a safer initial limit for the child-only filter', async () => {
    const { supabase, fetchMock } = createApiMock(async () => ({
      data: { type: 'FeatureCollection', features: [] },
      error: null,
    }))

    await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      { ...DEFAULT_HEATMAP_FILTERS, childFilter: true },
    )

    const url = calledUrl(fetchMock)
    expect(url.searchParams.get('child')).toBe('true')
    expect(url.searchParams.has('young')).toBe(false)
    expect(url.searchParams.get('limit')).toBe('5000')
  })

  it('passes child and young filters together for AND semantics', async () => {
    const { supabase, fetchMock } = createApiMock(async () => ({
      data: { type: 'FeatureCollection', features: [] },
      error: null,
    }))

    await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      { ...DEFAULT_HEATMAP_FILTERS, childFilter: true, youngFilter: true },
    )

    const url = calledUrl(fetchMock)
    expect(url.searchParams.get('child')).toBe('true')
    expect(url.searchParams.get('young')).toBe('true')
  })

  it('surfaces non-timeout cancellation errors after bounded retries', async () => {
    const { supabase, fetchMock } = createApiMock(async () => ({
      data: null,
      error: { message: 'canceling statement due to user request' },
      status: 500,
    }))

    await expect(fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )).rejects.toThrow('事故データの取得に失敗しました: canceling statement due to user request')

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
