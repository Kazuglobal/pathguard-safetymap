import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccidentSceneryDialog } from '@/components/map/accident-scenery-dialog'

vi.unmock('@/components/ui/dialog')
const paidLoader = vi.hoisted(() => vi.fn(() => { throw new Error('Paid API must not be loaded') }))
vi.mock('@/lib/street-view', () => ({ loadStreetView: paidLoader }))
const target = { coordinates: [139.767125, 35.681236] as [number, number], properties: { year: 2024, severity: 2, type: '追突', fatalities: 0, injuries: 1, hasChild: true } }

describe('accident scenery using only free embeds', () => {
  beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY', 'test-embed-key') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('shows the same accident facts with two titled Google iframes in the real dialog portal', () => {
    const { unmount } = render(<AccidentSceneryDialog target={target} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: '現地の景色' })).toBeInTheDocument()
    expect(screen.getByText('2024年')).toBeInTheDocument()
    expect(screen.getByText('追突')).toBeInTheDocument()
    expect(screen.getByText('子ども関与（補充票確認分）')).toBeInTheDocument()
    expect(screen.getByText('事故当時の写真ではなく、周辺の景色です。')).toBeInTheDocument()
    expect(screen.getByText(/撮影位置は事故地点と異なる場合があります/)).toBeInTheDocument()
    const map = screen.getByTitle('事故地点のGoogle地図')
    const street = screen.getByTitle('事故地点周辺のストリートビュー')
    for (const frame of [map, street]) {
      expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
      expect(frame).toHaveAttribute('allowfullscreen')
      expect(frame.getAttribute('src')).toMatch(/^https:\/\/www.google.com\/maps\/embed\/v1\//)
    }
    expect(paidLoader).not.toHaveBeenCalled()
    unmount()
    expect(document.querySelectorAll('iframe')).toHaveLength(0)
  })

  it('keeps a retry action after iframe load without claiming that imagery exists', () => {
    render(<AccidentSceneryDialog target={target} onClose={vi.fn()} />)
    const map = screen.getByTitle('事故地点のGoogle地図')
    const street = screen.getByTitle('事故地点周辺のストリートビュー')
    fireEvent.load(street)
    expect(screen.queryByText(/表示に成功/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }))
    expect(screen.getByTitle('事故地点のGoogle地図')).not.toBe(map)
    expect(screen.getByTitle('事故地点周辺のストリートビュー')).not.toBe(street)
  })

  it('updates both embeds for a new accident without retaining the previous frames', () => {
    const view = render(<AccidentSceneryDialog target={target} onClose={vi.fn()} />)
    view.rerender(<AccidentSceneryDialog target={{ ...target, coordinates: [141.716, 39.081] }} onClose={vi.fn()} />)
    for (const frame of document.querySelectorAll('iframe')) {
      expect(frame.src).not.toContain('35.681236')
      expect(frame.src).toContain('39.081')
    }
  })

  it('explains missing configuration without falling back to the paid key', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'paid-key-must-not-be-used')
    render(<AccidentSceneryDialog target={target} onClose={vi.fn()} />)
    expect(screen.getByText(/現地の景色を表示する設定を確認中です/)).toBeInTheDocument()
    expect(document.querySelectorAll('iframe')).toHaveLength(0)
    expect(paidLoader).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '元の地図に戻る' })).toBeInTheDocument()
  })

  it('closes with the back button and Escape', async () => {
    const close = vi.fn()
    render(<AccidentSceneryDialog target={target} onClose={close} />)
    fireEvent.click(screen.getByRole('button', { name: '元の地図に戻る' }))
    expect(close).toHaveBeenCalledOnce()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(close).toHaveBeenCalledTimes(2))
  })
})
