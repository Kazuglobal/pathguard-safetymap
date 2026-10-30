import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PointHazardSection } from '@/components/map/point-hazard-section'
describe('map selected point hazard learning', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('shows outside and unrecorded separately and identifies the selected point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hazards: { flood: { kind: 'outside', sources: [] }, tsunami: { kind: 'no_coverage', sources: [] } } }) }))
    render(<PointHazardSection center={[139, 35]} locationSource="map" />)
    expect(await screen.findByText('洪水：想定区域外')).toBeInTheDocument()
    expect(screen.getByText('津波：未収録')).toBeInTheDocument()
    expect(screen.getByText(/安全を保証/)).toBeInTheDocument()
    expect(screen.getByText(/地図で選択した地点/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '浸水の深さを見る' })).not.toBeInTheDocument()
  })
  it('requires manual start inside the learning dialog and labels GPS separately', async () => {
    const inside = { kind: 'inside', sources: [], zone: { zoneId: 'z', depthMinMeters: null, depthMaxMeters: null, sourceLayer: 's' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hazards: { flood: inside, tsunami: { kind: 'unavailable', sources: [] } } }) }))
    render(<PointHazardSection center={[139, 35]} locationSource="gps" />)
    fireEvent.click(await screen.findByRole('button', { name: '浸水の深さを見る' }))
    expect(screen.getByText(/カメラ映像ではありません/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '立ち止まって説明を見る' })).toBeInTheDocument()
  })
})
