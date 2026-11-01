import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ARInundationOverlay } from '@/components/map/ar-inundation-overlay'
import { HAZARD_WATER_SCENE_NOTICE } from '@/lib/hazard-point'
import type { HazardPointRisk } from '@/lib/hazard-point'
import type { DeviceTilt } from '@/lib/ar-water-geometry'

// WebGLの水面は next/dynamic で読み込むため、受け取るpropsを見られるスタブに差し替える。
vi.mock('next/dynamic', () => ({
  default: () =>
    function WaterSceneStub(props: {
      hazard: string
      playing: boolean
      reducedMotion: boolean
      onFailure: (reason: string) => void
    }) {
      return (
        <div
          data-testid="water-scene"
          data-hazard={props.hazard}
          data-playing={String(props.playing)}
          data-reduced={String(props.reducedMotion)}
        >
          <button type="button" onClick={() => props.onFailure('WebGLの描画が中断されました')}>
            fail-scene
          </button>
        </div>
      )
    },
}))

const inside = (min: number | null = 0.5, max: number | null = 3): HazardPointRisk => ({
  kind: 'inside',
  sources: [],
  zone: { zoneId: 'zone', sourceLayer: 'official', depthMinMeters: min, depthMaxMeters: max },
})

function setup({ live = true, tiltReady = true, min = 0.5 as number | null, max = 3 as number | null } = {}) {
  const videoRef = { current: document.createElement('video') }
  const tiltRef: { current: DeviceTilt | null } = { current: { beta: 85, gamma: -2, screenAngle: 0, timestamp: 0 } }
  return render(
    <ARInundationOverlay
      risks={{ flood: inside(min, max), tsunami: { kind: 'no_coverage', sources: [] } }}
      selected="flood"
      onSelect={vi.fn()}
      onClose={vi.fn()}
      live={live}
      videoRef={videoRef}
      tiltRef={tiltRef}
      tiltReady={tiltReady}
      sourceHorizontalFovDeg={60}
    />,
  )
}

const start = () => fireEvent.click(screen.getByRole('button', { name: /立ち止まって/ }))

describe('inundation learning water scene', () => {
  it('states the assumed-plane limit before playing and while showing', () => {
    setup()
    expect(screen.getAllByText(HAZARD_WATER_SCENE_NOTICE).length).toBeGreaterThan(0)
    start()
    expect(screen.getAllByText(HAZARD_WATER_SCENE_NOTICE).length).toBeGreaterThan(0)
    expect(screen.getByText(/浸水想定を理解するためのイメージ/)).toBeInTheDocument()
  })

  it('overlays the water on the camera once a valid tilt is available', () => {
    setup()
    expect(screen.queryByTestId('water-scene')).not.toBeInTheDocument()
    start()
    const scene = screen.getByTestId('water-scene')
    expect(scene).toHaveAttribute('data-hazard', 'flood')
    expect(scene).toHaveAttribute('data-playing', 'true')
    // 画面を重ねている間は、2Dの水画像を二重に出さない。比較図と範囲は残す。
    expect(document.querySelector('.ar-depth-water')).toBeNull()
    expect(screen.getByLabelText('人物と想定浸水深の高さ比較')).toBeInTheDocument()
    expect(screen.getAllByText('0.5〜3.0m').length).toBeGreaterThan(0)
  })

  it('falls back to the comparison figure without a valid tilt', () => {
    setup({ tiltReady: false })
    start()
    expect(screen.queryByTestId('water-scene')).not.toBeInTheDocument()
    expect(screen.getByText(/端末の傾きを取得できないため/)).toBeInTheDocument()
    expect(document.querySelector('.ar-depth-water')).not.toBeNull()
  })

  it('does not overlay the current camera for a point chosen on the map', () => {
    setup({ live: false })
    start()
    expect(screen.queryByTestId('water-scene')).not.toBeInTheDocument()
    expect(screen.queryByText(HAZARD_WATER_SCENE_NOTICE)).not.toBeInTheDocument()
    expect(document.querySelector('.ar-depth-water')).not.toBeNull()
  })

  it('retires the scene after a webgl failure and does not restart it', () => {
    setup()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'fail-scene' }))
    expect(screen.queryByTestId('water-scene')).not.toBeInTheDocument()
    expect(screen.getByText('WebGLの描画が中断されました')).toBeInTheDocument()
    expect(document.querySelector('.ar-depth-water')).not.toBeNull()
    // 退避後に再生操作をしても、失敗したシーンを再起動しない
    fireEvent.click(screen.getByRole('button', { name: 'もう一度' }))
    expect(screen.queryByTestId('water-scene')).not.toBeInTheDocument()
  })

  it('keeps the scene out when the depth is unknown', () => {
    setup({ min: null, max: null })
    start()
    expect(screen.queryByTestId('water-scene')).not.toBeInTheDocument()
    expect(screen.getByText(/深さの情報がない/)).toBeInTheDocument()
  })

  it('stops the motion for reduced motion while keeping the overlay', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.mocked(window.matchMedia).mockReturnValueOnce({ ...media, matches: true })
    setup()
    start()
    expect(screen.getByTestId('water-scene')).toHaveAttribute('data-reduced', 'true')
  })

  it('shows the official depth guide with its source and caveat', () => {
    setup()
    start()
    expect(screen.getByText(/建物2階の床面まで浸水するおそれ/)).toBeInTheDocument()
    expect(screen.getByText(/あなた自身を測った値ではありません/)).toBeInTheDocument()
    expect(screen.getByText(/江戸川河川事務所/)).toBeInTheDocument()
  })
})
