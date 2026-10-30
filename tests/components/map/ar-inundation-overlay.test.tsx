import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ARInundationOverlay } from '@/components/map/ar-inundation-overlay'
import type { HazardPointRisk } from '@/lib/hazard-point'

function setup(min: number | null = .5, max: number | null = 3, suppressed = false) {
  const inside: HazardPointRisk = { kind: 'inside', sources: [], zone: { zoneId: 'zone', sourceLayer: 'official', depthMinMeters: min, depthMaxMeters: max } }
  return render(<ARInundationOverlay risks={{ flood: inside, tsunami: { kind: 'no_coverage', sources: [] } }} selected="flood" onSelect={vi.fn()} onClose={vi.fn()} suppressed={suppressed} />)
}
describe('inundation learning controls', () => {
  it('starts only after acknowledgement and supports pause and replay', () => {
    setup()
    expect(screen.queryByLabelText('人物と想定浸水深の高さ比較')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '立ち止まって再生する' }))
    expect(screen.getByLabelText('人物と想定浸水深の高さ比較')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '一時停止' }))
    expect(screen.getByRole('button', { name: '再生する' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もう一度' }))
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
  })
  it('does not draw a height for unknown depth', () => {
    setup(null, null)
    fireEvent.click(screen.getByRole('button', { name: '立ち止まって説明を見る' }))
    expect(screen.queryByLabelText('人物と想定浸水深の高さ比較')).not.toBeInTheDocument()
    expect(screen.getByText(/深さの情報がない/)).toBeInTheDocument()
  })
  it('does not invent a finite endpoint for an open range', () => {
    setup(20, null)
    fireEvent.click(screen.getByRole('button', { name: '立ち止まって再生する' }))
    expect(screen.getByText('上限なし')).toBeInTheDocument()
  })
  it('prevents animation when safety suppression is active', () => {
    setup(.5, 3, true)
    expect(screen.getByRole('button', { name: '立ち止まって再生する' })).toBeDisabled()
  })
  it('uses a static comparison when reduced motion is requested', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.mocked(window.matchMedia).mockReturnValueOnce({ ...media, matches: true })
    setup()
    fireEvent.click(screen.getByRole('button', { name: '立ち止まって再生する' }))
    expect(screen.getByRole('button', { name: '静止画で表示中' })).toBeDisabled()
    expect(document.querySelector('.ar-depth-water')).toHaveStyle({ animationName: 'none' })
  })
})
