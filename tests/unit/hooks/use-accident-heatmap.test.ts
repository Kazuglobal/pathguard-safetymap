import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccidentHeatmap } from '@/hooks/use-accident-heatmap'
import { FETCH_DEBOUNCE_MS } from '@/lib/traffic-accident-heatmap'

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
})
