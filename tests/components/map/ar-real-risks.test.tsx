import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ARRealRisks } from '@/components/map/ar-real-risks'
import { DEFAULT_HEATMAP_FILTERS } from '@/lib/traffic-accident-heatmap'
const mocks = vi.hoisted(() => ({ data: vi.fn() }))
vi.mock('@/hooks/use-ar-risk-data', () => ({ useARRiskData: mocks.data }))
const props = { enabled: true, point: { lat: 35, lon: 139 }, heading: 0, orientation: true,
  distance: 500, fov: 60, filters: DEFAULT_HEATMAP_FILTERS, suppressed: false, onStreetView: vi.fn() }
describe('AR record selection', () => {
  it('keeps the opened accident when heading changes while viewing its panorama', () => {
    mocks.data.mockReturnValue({ accidents: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139, 35.001] }, properties: { id: 1, year: 2024, type: '追突', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139, 34.999] }, properties: { id: 2, year: 2023, type: '車両単独', severity: 2 } },
    ] }, hazards: null, retry: vi.fn() })
    const view = render(<ARRealRisks {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '現地の景色を見る' }))
    expect(props.onStreetView).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ id: 1 }) }))
    view.rerender(<ARRealRisks {...props} heading={180} />)
    const dock = within(screen.getByRole('region', { name: '実事故と浸水想定' }))
    expect(dock.getByRole('heading', { name: '追突' })).toBeInTheDocument()
    expect(dock.queryByRole('heading', { name: '車両単独' })).not.toBeInTheDocument()
    fireEvent.click(dock.getByRole('button', { name: '現地の景色を見る' }))
    expect(props.onStreetView).toHaveBeenLastCalledWith(expect.objectContaining({ properties: expect.objectContaining({ id: 1 }) }))
    // Moving beyond the display range must not retain a stale selected point.
    view.rerender(<ARRealRisks {...props} point={{ lat: 35.02, lon: 139 }} heading={180} />)
    expect(screen.queryByRole('button', { name: '現地の景色を見る' })).not.toBeInTheDocument()
  })
})
