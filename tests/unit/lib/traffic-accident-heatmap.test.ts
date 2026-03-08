import { describe, it, expect, vi } from 'vitest'
import {
  fetchAccidentsInBounds,
  DEFAULT_HEATMAP_FILTERS,
  type AccidentGeoJSON,
} from '@/lib/traffic-accident-heatmap'

function createSupabaseRpcMock(
  impl: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  return {
    rpc: vi.fn(impl),
  } as any
}

describe('traffic-accident-heatmap', () => {
  it('returns empty collection and skips RPC when bounds are invalid', async () => {
    const supabase = createSupabaseRpcMock(async () => ({
      data: null,
      error: null,
    }))

    const result = await fetchAccidentsInBounds(
      supabase,
      { minLng: 999, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('normalizes bounds and filter inputs before RPC call', async () => {
    const response: AccidentGeoJSON = { type: 'FeatureCollection', features: [] }
    const supabase = createSupabaseRpcMock(async () => ({
      data: response,
      error: null,
    }))

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

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    const [, params] = vi.mocked(supabase.rpc).mock.calls[0]
    expect(params).toMatchObject({
      p_min_lng: 139,
      p_min_lat: 35,
      p_max_lng: 140,
      p_max_lat: 36,
      p_min_year: 2020,
      p_max_year: 2024,
      p_severity_filter: 'all',
      p_child_filter: null,
      p_young_filter: true,
      p_pedestrian_filter: true,
    })
  })

  it('throws with readable message when RPC fails', async () => {
    const supabase = createSupabaseRpcMock(async () => ({
      data: null,
      error: { message: 'permission denied' },
    }))

    await expect(
      fetchAccidentsInBounds(
        supabase,
        { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
        DEFAULT_HEATMAP_FILTERS,
      ),
    ).rejects.toThrow('事故データの取得に失敗しました: permission denied')
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('returns empty collection when RPC returns malformed payload', async () => {
    const supabase = createSupabaseRpcMock(async () => ({
      data: { foo: 'bar' },
      error: null,
    }))

    const result = await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )

    expect(result).toEqual({ type: 'FeatureCollection', features: [] })
  })

  it('retries with lower limit when statement gets canceled', async () => {
    const response: AccidentGeoJSON = { type: 'FeatureCollection', features: [] }
    const supabase = createSupabaseRpcMock(async () => {
      const callCount = vi.mocked(supabase.rpc).mock.calls.length
      if (callCount === 1) {
        return {
          data: null,
          error: { message: 'canceling statement due to statement timeout' },
        }
      }
      return {
        data: response,
        error: null,
      }
    })

    const result = await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      DEFAULT_HEATMAP_FILTERS,
    )

    expect(result).toEqual(response)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)

    const [, firstParams] = vi.mocked(supabase.rpc).mock.calls[0]
    const [, secondParams] = vi.mocked(supabase.rpc).mock.calls[1]
    expect(firstParams.p_limit).toBe(10000)
    expect(secondParams.p_limit).toBe(5000)
  })

  it('uses safer initial limit for child-only filter', async () => {
    const supabase = createSupabaseRpcMock(async () => ({
      data: { type: 'FeatureCollection', features: [] },
      error: null,
    }))

    await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      {
        ...DEFAULT_HEATMAP_FILTERS,
        childFilter: true,
      },
    )

    const [, params] = vi.mocked(supabase.rpc).mock.calls[0]
    expect(params.p_child_filter).toBe(true)
    expect(params.p_young_filter).toBeNull()
    expect(params.p_limit).toBe(5000)
  })

  it('passes both child and young filters together for AND semantics', async () => {
    const supabase = createSupabaseRpcMock(async () => ({
      data: { type: 'FeatureCollection', features: [] },
      error: null,
    }))

    await fetchAccidentsInBounds(
      supabase,
      { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      {
        ...DEFAULT_HEATMAP_FILTERS,
        childFilter: true,
        youngFilter: true,
      },
    )

    const [, params] = vi.mocked(supabase.rpc).mock.calls[0]
    expect(params.p_child_filter).toBe(true)
    expect(params.p_young_filter).toBe(true)
  })

  it('surfaces canceling statement errors when request is not aborted by client', async () => {
    const supabase = createSupabaseRpcMock(async () => ({
      data: null,
      error: { message: 'canceling statement due to user request' },
    }))

    await expect(
      fetchAccidentsInBounds(
        supabase,
        { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
        DEFAULT_HEATMAP_FILTERS,
      ),
    ).rejects.toThrow('事故データの取得に失敗しました: canceling statement due to user request')

    expect(supabase.rpc).toHaveBeenCalledTimes(4)
  })
})
