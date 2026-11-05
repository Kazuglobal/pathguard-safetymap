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

describe('AR accident dock visibility', () => {
  const hazards = {
    flood: { kind: 'outside' as const, sources: [] },
    tsunami: { kind: 'no_coverage' as const, sources: [] },
  }
  function setup() {
    mocks.data.mockReturnValue({
      accidents: { type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [139, 35.001] }, properties: { id: 1, year: 2024, type: '追突', severity: 2 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [139, 35.0012] }, properties: { id: 2, year: 2022, type: '出会い頭', severity: 2 } },
      ] },
      hazards: { point: { latitude: 35, longitude: 139 }, hazards }, retry: vi.fn(),
    })
    return render(<ARRealRisks {...props} />)
  }

  it('folds the details away but keeps the record, the scene action and the hazard state', () => {
    setup()
    expect(screen.getByRole('heading', { name: '追突' })).toBeInTheDocument()
    expect(screen.getByText(/近くの実事故/)).toBeInTheDocument()
    expect(screen.getByText(/事故出典/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '詳細をたたむ' }))

    // たたむ: 事故の詳細・近くの一覧・出典は隠す
    expect(screen.queryByRole('heading', { name: '追突' })).not.toBeInTheDocument()
    expect(screen.queryByText(/近くの実事故/)).not.toBeInTheDocument()
    expect(screen.queryByText(/事故出典/)).not.toBeInTheDocument()
    // たたんでも: 条件・選んだ事故の要点・景色を見る操作・浸水の状態と注意文は残す
    expect(screen.getByText(/表示距離500m/)).toBeInTheDocument()
    expect(screen.getByText(/実事故 2024年・追突/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現地の景色を見る' })).toBeInTheDocument()
    expect(screen.getByText(/想定区域外/)).toBeInTheDocument()
    // たたんだときは短い表記で残す
    expect(screen.getByText(/（安全の保証ではありません）/)).toBeInTheDocument()
    expect(screen.getByText(/（安全という意味ではありません）/)).toBeInTheDocument()
    expect(screen.getAllByText(/未収録/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '詳細をひらく' }))
    expect(screen.getByRole('heading', { name: '追突' })).toBeInTheDocument()
  })
})

describe('AR accidents outside the camera view', () => {
  it('shows records behind the camera in the dock, the edge guide and the turn hint', () => {
    mocks.data.mockReturnValue({ accidents: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139, 34.9993] }, properties: { id: 7, year: 2025, type: '人対車両', severity: 2, roadShape: '交差点' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139, 35.004] }, properties: { id: 8, year: 2021, type: '追突', severity: 2 } },
    ] }, hazards: null, retry: vi.fn() })
    render(<ARRealRisks {...props} heading={0} />)
    // 正面(北)の事故はピンとして出る
    expect(screen.getByRole('button', { name: /実事故 約445m/ })).toBeInTheDocument()
    // 後ろ(南)のもっと近い事故は端の案内に出る
    fireEvent.click(screen.getByRole('button', { name: /後ろに実事故1件・最寄り約78m/ }))
    const dock = within(screen.getByRole('region', { name: '実事故と浸水想定' }))
    expect(dock.getByRole('heading', { name: '人対車両' })).toBeInTheDocument()
    expect(dock.getByText(/後ろ・南の方角・約78m先/)).toBeInTheDocument()
    expect(dock.getByText('道路形状：交差点')).toBeInTheDocument()
    expect(dock.getByText(/画面の外です。.へ約180°向くと見えます/)).toBeInTheDocument()
    expect(dock.getByText(/500m以内 2件・近い順/)).toBeInTheDocument()
  })
})
