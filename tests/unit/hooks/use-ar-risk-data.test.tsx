import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useARRiskData } from '@/hooks/use-ar-risk-data'
import { DEFAULT_HEATMAP_FILTERS } from '@/lib/traffic-accident-heatmap'

const mocks = vi.hoisted(() => ({ accidents: vi.fn() }))
vi.mock('@/lib/traffic-accident-heatmap', async original => ({
  ...await original<typeof import('@/lib/traffic-accident-heatmap')>(), fetchAccidentFeatures: mocks.accidents,
}))
const inside = { kind: 'inside', zone: { zoneId: 'zone', sourceLayer: 'official', depthMinMeters: .5, depthMaxMeters: 3 }, sources: [] }
const verdict = () => ({ hazards: { flood: inside, tsunami: { kind: 'no_coverage', sources: [] } } })
const props = { enabled: true, point: { lat: 35, lon: 139 }, distance: 500, filters: DEFAULT_HEATMAP_FILTERS }

describe('AR risk fetching', () => {
  beforeEach(() => {
    mocks.accidents.mockResolvedValue({ type: 'FeatureCollection', features: [] })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => verdict() }))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })
  it('does not refetch on small sensor movements and requires a second verdict', async () => {
    const hook = renderHook(p => useARRiskData(p), { initialProps: props })
    await waitFor(() => expect(hook.result.current.hazards?.hazards.flood.confirmed).toBe(false))
    hook.rerender({ ...props, point: { lat: 35.0001, lon: 139 } })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.accidents).toHaveBeenCalledTimes(1)
    vi.useFakeTimers()
    // Explicit retry is also a second independent server verdict.
    await act(async () => { hook.result.current.retry() })
    expect(hook.result.current.hazards?.hazards.flood.confirmed).toBe(true)
  })
  it('aborts an old lookup when the position changes and ignores its late response', async () => {
    let resolve!: (x: unknown) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => { resolve = r }) as Promise<Response>)
    const hook = renderHook(p => useARRiskData(p), { initialProps: props })
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
    hook.rerender({ ...props, point: { lat: 35.001, lon: 139 } })
    expect(signal?.aborted).toBe(true)
    await act(async () => { resolve({ ok: true, json: async () => verdict() }) })
    expect(hook.result.current.hazards).toBeNull()
  })
  it('clears data and cancels work while inactive', async () => {
    const hook = renderHook(p => useARRiskData(p), { initialProps: props })
    await waitFor(() => expect(hook.result.current.accidents).not.toBeNull())
    hook.rerender({ ...props, enabled: false })
    expect(hook.result.current.accidents).toBeNull()
    expect(hook.result.current.hazards).toBeNull()
  })
})
