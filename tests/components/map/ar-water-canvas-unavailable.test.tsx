import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { _roots } from '@react-three/fiber'
import { afterEach, expect, it, vi } from 'vitest'
import { ARWaterCanvas } from '@/components/map/ar-water-canvas'

afterEach(() => vi.restoreAllMocks())

it('uses the real Three renderer to reject WebGL 1-only devices without retaining a Fiber root', async () => {
  // Keep Three and R3F real; only the browser's unavailable WebGL 2 context is simulated.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
    kind === 'webgl' ? {} : null
  ) as never)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Harness() {
    const [reason, setReason] = useState<string | null>(null)
    return reason ? <p role="status">{reason}</p> : <ARWaterCanvas onFailure={setReason}><group /></ARWaterCanvas>
  }
  expect(document.createElement('canvas').getContext('webgl')).toBeTruthy()
  const initialRoots = _roots.size
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const view = render(<Harness />)
    expect(await screen.findByRole('status')).toHaveTextContent('この端末では水面の表示を初期化できませんでした')
    expect(view.container.querySelector('canvas')).toBeNull()
    expect(_roots.size).toBe(initialRoots)
    view.unmount()
  }
})
