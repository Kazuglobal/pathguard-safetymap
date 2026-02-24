import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccidentHeatmap } from '@/hooks/use-accident-heatmap'
import { FETCH_DEBOUNCE_MS, type AccidentGeoJSON } from '@/lib/traffic-accident-heatmap'

vi.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: vi.fn(),
}))

vi.mock('@/lib/traffic-accident-heatmap', async () => {
  const actual = await vi.importActual<typeof import('@/lib/traffic-accident-heatmap')>(
    '@/lib/traffic-accident-heatmap',
  )
  return {
    ...actual,
    fetchAccidentsInBounds: vi.fn(),
  }
})

import { useSupabase } from '@/components/providers/supabase-provider'
import { fetchAccidentsInBounds } from '@/lib/traffic-accident-heatmap'

describe('useAccidentHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.mocked(useSupabase).mockReturnValue({
      supabase: { rpc: vi.fn() } as any,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with hidden and empty state', () => {
    const { result } = renderHook(() => useAccidentHeatmap())

    expect(result.current.geoJSON).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.isVisible).toBe(false)
    expect(result.current.featureCount).toBe(0)
  })

  it('fetches viewport data with debounce', async () => {
    vi.mocked(fetchAccidentsInBounds).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    })

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility()
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS - 1)
    })

    expect(fetchAccidentsInBounds).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(fetchAccidentsInBounds).toHaveBeenCalledTimes(1)
  })

  it('keeps only latest debounced request when called repeatedly', async () => {
    vi.mocked(fetchAccidentsInBounds).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    })

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility()
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
      result.current.fetchForViewport({
        minLng: 130,
        minLat: 30,
        maxLng: 131,
        maxLat: 31,
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS)
      await Promise.resolve()
    })

    expect(fetchAccidentsInBounds).toHaveBeenCalledTimes(1)
    const [, calledBounds] = vi.mocked(fetchAccidentsInBounds).mock.calls[0]
    expect(calledBounds).toMatchObject({
      minLng: 130,
      minLat: 30,
      maxLng: 131,
      maxLat: 31,
    })
  })

  it('does not auto-refetch only from filter updates', async () => {
    vi.mocked(fetchAccidentsInBounds).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    })

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility()
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS)
      await Promise.resolve()
    })

    expect(fetchAccidentsInBounds).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.setFilters({ severityFilter: 'fatal' })
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS + 10)
      await Promise.resolve()
    })

    expect(fetchAccidentsInBounds).toHaveBeenCalledTimes(1)
  })

  it('skips fetchForViewport while hidden', async () => {
    vi.mocked(fetchAccidentsInBounds).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    })

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS + 10)
    })

    expect(fetchAccidentsInBounds).not.toHaveBeenCalled()
  })

  it('cancels pending debounced fetch when toggled hidden', async () => {
    vi.mocked(fetchAccidentsInBounds).mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    })

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility() // show
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
      result.current.toggleVisibility() // hide before debounce fires
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS + 10)
    })

    expect(fetchAccidentsInBounds).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('does not surface abort-like errors as user-facing error', async () => {
    vi.mocked(fetchAccidentsInBounds).mockRejectedValue(new Error('AbortError'))

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility()
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS)
      await Promise.resolve()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('aborts previous in-flight request before starting a new one', async () => {
    let firstResolve: ((value: AccidentGeoJSON) => void) | null = null
    const signals: AbortSignal[] = []

    vi.mocked(fetchAccidentsInBounds).mockImplementation(async (_supabase, _bounds, _filters, options) => {
      const signal = options?.signal as AbortSignal
      signals.push(signal)

      if (signals.length === 1) {
        return await new Promise<AccidentGeoJSON>((resolve) => {
          firstResolve = resolve
        })
      }

      return {
        type: 'FeatureCollection',
        features: [],
      }
    })

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility()
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(signals).toHaveLength(1)
    expect(signals[0]?.aborted).toBe(false)

    act(() => {
      result.current.fetchForViewport({
        minLng: 130,
        minLat: 30,
        maxLng: 131,
        maxLat: 31,
      })
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)

    await act(async () => {
      firstResolve?.({ type: 'FeatureCollection', features: [] })
      await Promise.resolve()
    })
  })

  it('surfaces database cancel errors when not aborted by client', async () => {
    vi.mocked(fetchAccidentsInBounds).mockRejectedValue(
      new Error('事故データの取得に失敗しました: canceling statement due to user request'),
    )

    const { result } = renderHook(() => useAccidentHeatmap())

    act(() => {
      result.current.toggleVisibility()
      result.current.fetchForViewport({
        minLng: 139,
        minLat: 35,
        maxLng: 140,
        maxLat: 36,
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(FETCH_DEBOUNCE_MS)
      await Promise.resolve()
    })

    expect(result.current.error).toBe('事故データの取得に失敗しました: canceling statement due to user request')
    expect(result.current.isLoading).toBe(false)
  })
})
