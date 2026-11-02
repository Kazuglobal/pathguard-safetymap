import { act, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARWaterScene, type ARWaterSceneProps } from '@/components/map/ar-water-scene'
import { buildDepthTimeline } from '@/lib/ar-water-geometry'

const engine = vi.hoisted(() => ({
  createRoot: vi.fn(), configure: vi.fn(), render: vi.fn(), unmount: vi.fn(),
  setSize: vi.fn(),
  createRenderer: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn(),
}))
vi.mock('@react-three/fiber', () => ({
  createRoot: engine.createRoot,
  extend: vi.fn(),
  useFrame: vi.fn(),
  useThree: vi.fn(),
  // The original high-level Canvas cannot forward asynchronous configure failures.
  Canvas: () => null,
}))
vi.mock('@react-three/drei', () => ({ Html: () => null }))
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  return { ...actual, WebGLRenderer: engine.createRenderer }
})

function props(): ARWaterSceneProps {
  return {
    videoRef: { current: document.createElement('video') },
    tiltRef: { current: { beta: 90, gamma: 0, screenAngle: 0, timestamp: 0 } },
    timeline: buildDepthTimeline({ depthMinMeters: 0.5, depthMaxMeters: 3 })!,
    hazard: 'flood', playing: true, reducedMotion: false, replayKey: 0,
    sourceHorizontalFovDeg: 60, onFailure: vi.fn(),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  engine.createRoot.mockReturnValue(engine)
  engine.configure.mockResolvedValue(engine)
  engine.render.mockReturnValue({ getState: () => ({ setSize: engine.setSize }) })
  engine.createRenderer.mockImplementation(function () {
    return { dispose: engine.dispose, forceContextLoss: engine.forceContextLoss }
  })
  // Reproduce a device that only supports WebGL 1; the actual renderer requires WebGL 2.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
    kind === 'webgl' ? {} : null
  ) as never)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('water scene renderer lifecycle', () => {
  it('falls back when WebGL 2 renderer initialization rejects, even if WebGL 1 is available', async () => {
    engine.createRenderer.mockImplementationOnce(function () { throw new Error('Error creating WebGL context.') })
    const input = props()
    render(<ARWaterScene {...input} />)
    await waitFor(() => expect(input.onFailure).toHaveBeenCalledTimes(1))
    expect(engine.render).not.toHaveBeenCalled()
    expect(engine.createRoot).not.toHaveBeenCalled()
  })

  it('falls back for synchronous root initialization errors', async () => {
    engine.createRoot.mockImplementationOnce(() => { throw new Error('root creation failed') })
    const input = props()
    const view = render(<ARWaterScene {...input} />)
    await waitFor(() => expect(input.onFailure).toHaveBeenCalledTimes(1))
    view.unmount()
    expect(engine.dispose).toHaveBeenCalledTimes(1)
    expect(engine.forceContextLoss).toHaveBeenCalledTimes(1)
  })

  it('forwards asynchronous configure failures and disposes the prepared renderer', async () => {
    engine.configure.mockRejectedValueOnce(new Error('configuration failed'))
    const input = props()
    const view = render(<ARWaterScene {...input} />)
    await waitFor(() => expect(input.onFailure).toHaveBeenCalledTimes(1))
    expect(engine.render).not.toHaveBeenCalled()
    view.unmount()
    expect(engine.unmount).toHaveBeenCalled()
    expect(engine.dispose).toHaveBeenCalledTimes(1)
  })

  it('waits for initialization and reuses the renderer for playback updates', async () => {
    const input = props()
    const view = render(<ARWaterScene {...input} />)
    await waitFor(() => expect(engine.render).toHaveBeenCalled())
    const initialized = engine.createRoot.mock.calls[0][0] as HTMLCanvasElement
    expect(initialized).toBeInstanceOf(HTMLCanvasElement)
    view.rerender(<ARWaterScene {...input} playing={false} />)
    expect(engine.createRoot).toHaveBeenCalledTimes(1)
    // Reconfiguring with only size resets R3F's DPR and onCreated callback to defaults.
    expect(engine.configure).toHaveBeenCalledTimes(1)
    expect(engine.setSize).toHaveBeenCalled()
    expect(engine.render.mock.calls.length).toBeGreaterThan(1)
    expect(input.onFailure).not.toHaveBeenCalled()
    view.unmount()
    expect(engine.unmount).toHaveBeenCalled()
    expect(initialized.isConnected).toBe(false)
  })

  it('does not render or report a late rejection after unmount', async () => {
    let rejectInitialization: (error: Error) => void
    engine.configure.mockImplementationOnce(() => new Promise((_, reject) => { rejectInitialization = reject }))
    const input = props()
    const view = render(<ARWaterScene {...input} />)
    await waitFor(() => expect(engine.configure).toHaveBeenCalled())
    view.unmount()
    await act(async () => { rejectInitialization(new Error('late initialization failure')) })
    expect(engine.render).not.toHaveBeenCalled()
    expect(input.onFailure).not.toHaveBeenCalled()
    expect(engine.unmount).toHaveBeenCalled()
  })

  it('does not render after an initialization that resolves after unmount', async () => {
    let finishInitialization: () => void
    engine.configure.mockImplementationOnce(() => new Promise(resolve => { finishInitialization = () => resolve(engine) }))
    const input = props()
    const view = render(<ARWaterScene {...input} />)
    await waitFor(() => expect(engine.configure).toHaveBeenCalled())
    view.unmount()
    await act(async () => { finishInitialization() })
    expect(engine.render).not.toHaveBeenCalled()
    expect(input.onFailure).not.toHaveBeenCalled()
  })

  it('forwards shader compilation failures to the comparison fallback once', async () => {
    const input = props()
    render(<ARWaterScene {...input} />)
    await waitFor(() => expect(engine.configure).toHaveBeenCalled())
    const config = engine.configure.mock.calls[0][0]
    const gl = { setClearAlpha: vi.fn(), debug: { onShaderError: undefined as (() => void) | undefined } }
    await act(async () => { config.onCreated({ gl }) })
    expect(gl.debug.onShaderError).toBeTypeOf('function')
    await act(async () => { gl.debug.onShaderError?.(); gl.debug.onShaderError?.() })
    expect(input.onFailure).toHaveBeenCalledTimes(1)
  })

  it('updates the size without resetting initialization callbacks or the DPR cap', async () => {
    let resize: () => void
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback }
      observe() {}
      disconnect() {}
    })
    const input = props()
    render(<ARWaterScene {...input} />)
    await waitFor(() => expect(engine.render).toHaveBeenCalled())
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 844, height: 390, top: 0, left: 0 } as DOMRect)
    act(() => resize())
    expect(engine.setSize).toHaveBeenLastCalledWith(844, 390, 0, 0)
    expect(engine.configure).toHaveBeenCalledTimes(1)
    expect(engine.configure.mock.calls[0][0].dpr).toEqual([1, 1.5])
    expect(engine.configure.mock.calls[0][0].onCreated).toBeTypeOf('function')
  })

  it('creates distinct canvases across StrictMode remounts and disposes both renderers', async () => {
    const input = props()
    const view = render(<StrictMode><ARWaterScene {...input} /></StrictMode>)
    await waitFor(() => expect(engine.render).toHaveBeenCalled())
    expect(engine.createRoot).toHaveBeenCalledTimes(2)
    expect(engine.createRoot.mock.calls[0][0]).not.toBe(engine.createRoot.mock.calls[1][0])
    expect(engine.createRoot.mock.calls[0][0].isConnected).toBe(false)
    view.unmount()
    expect(engine.dispose).toHaveBeenCalledTimes(2)
    expect(engine.forceContextLoss).toHaveBeenCalledTimes(2)
    expect(input.onFailure).not.toHaveBeenCalled()
  })

  it('reports context loss once and removes its listener before disposing the renderer', async () => {
    const input = props()
    const view = render(<ARWaterScene {...input} />)
    await waitFor(() => expect(engine.render).toHaveBeenCalled())
    const canvas = engine.createRoot.mock.calls[0][0] as HTMLCanvasElement
    const event = new Event('webglcontextlost', { cancelable: true })
    act(() => { canvas.dispatchEvent(event); canvas.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    expect(input.onFailure).toHaveBeenCalledExactlyOnceWith('WebGLの描画が中断されました')
    view.unmount()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(input.onFailure).toHaveBeenCalledTimes(1)
  })
})
