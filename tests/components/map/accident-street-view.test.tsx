import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccidentStreetView } from '@/components/map/accident-street-view'

vi.unmock('@/components/ui/dialog')
const mocks = vi.hoisted(() => ({ load: vi.fn(), query: vi.fn(), panorama: vi.fn(), hide: vi.fn(), clear: vi.fn() }))
vi.mock('@/lib/street-view', async original => ({ ...await original<typeof import('@/lib/street-view')>(), loadStreetView: mocks.load }))
const target = { coordinates: [139, 35] as [number, number], properties: { year: 2024, severity: 2, type: '追突', injuries: 1 } }
const imagery = { data: { location: { pano: 'official-pano', latLng: { toJSON: () => ({ lat: 35.0001, lng: 139 }) } }, imageDate: '2024-04' } }
const api = { maps: { StreetViewService: class { getPanorama = mocks.query },
  StreetViewPanorama: class { constructor(host: unknown, options: unknown) { mocks.panorama(host, options) } setVisible = mocks.hide },
  StreetViewPreference: { NEAREST: 'nearest' }, StreetViewSource: { OUTDOOR: 'outdoor' }, event: { clearInstanceListeners: mocks.clear },
} }
describe('official accident Street View', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(api); mocks.query.mockResolvedValue(imagery); vi.stubGlobal('google', api) })
  it('waits for the real dialog portal, requests outdoor Google imagery and faces the record', async () => {
    const view = render(<AccidentStreetView target={target} onClose={vi.fn()} />)
    await waitFor(() => expect(mocks.panorama).toHaveBeenCalledOnce())
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ radius: 50, sources: ['google', 'outdoor'] }))
    expect(mocks.panorama.mock.calls[0][1]).toMatchObject({ pano: 'official-pano', pov: { heading: 180, pitch: 0 }, imageDateControl: true })
    expect(screen.getByText(/撮影年月：2024-04/)).toBeInTheDocument()
    view.unmount()
    expect(mocks.hide).toHaveBeenCalledWith(false)
    expect(mocks.clear).toHaveBeenCalledOnce()
  })
  it('rejects imagery outside 50m instead of showing another place', async () => {
    mocks.query.mockResolvedValue({ data: { location: { pano: 'too-far', latLng: { toJSON: () => ({ lat: 35.01, lng: 139 }) } } } })
    render(<AccidentStreetView target={target} onClose={vi.fn()} />)
    expect(await screen.findByText(/50m以内に対象/)).toBeInTheDocument()
    expect(mocks.panorama).not.toHaveBeenCalled()
  })
  it('ignores a late response from the previous target', async () => {
    let resolve!: (data: unknown) => void
    mocks.query.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const view = render(<AccidentStreetView target={target} onClose={vi.fn()} />)
    await waitFor(() => expect(mocks.query).toHaveBeenCalledOnce())
    mocks.query.mockRejectedValue({ code: 'ZERO_RESULTS' })
    view.rerender(<AccidentStreetView target={{ ...target, coordinates: [140, 36] }} onClose={vi.fn()} />)
    await screen.findByText(/50m以内に対象/)
    await act(async () => resolve(imagery))
    expect(mocks.panorama).not.toHaveBeenCalled()
  })
  it('distinguishes authentication configuration from network failure', async () => {
    mocks.query.mockImplementation(() => new Promise(() => {}))
    render(<AccidentStreetView target={target} onClose={vi.fn()} />)
    await waitFor(() => expect(mocks.query).toHaveBeenCalledOnce())
    act(() => (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.())
    expect(screen.getByText(/表示する設定を確認中/)).toBeInTheDocument()
  })
})
