import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const createdSplats: Array<{ lodScale: number }> = []

vi.mock("three", () => {
  class Vector3 {
    x: number
    y: number
    z: number

    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }

    set(x: number, y: number, z: number) {
      this.x = x
      this.y = y
      this.z = z
      return this
    }

    copy(v: Vector3) {
      this.x = v.x
      this.y = v.y
      this.z = v.z
      return this
    }

    add(v: Vector3) {
      this.x += v.x
      this.y += v.y
      this.z += v.z
      return this
    }
  }

  class Box3 {
    isEmpty() {
      return false
    }

    getCenter(target: Vector3) {
      return target.set(0, 0, 0)
    }

    getSize(target: Vector3) {
      return target.set(1, 1, 1)
    }
  }

  class Color {
    constructor(_value: number) {}
  }

  class Scene {
    background: unknown
    add = vi.fn()
  }

  class PerspectiveCamera {
    aspect = 1
    position = new Vector3()

    constructor(
      _fov: number,
      _aspect: number,
      _near: number,
      _far: number,
    ) {}

    updateProjectionMatrix() {}
  }

  class WebGLRenderer {
    domElement: HTMLCanvasElement

    constructor(_options?: unknown) {
      this.domElement = document.createElement("canvas")
    }

    setPixelRatio(_value: number) {}
    setSize(_w: number, _h: number) {}
    render(_scene: unknown, _camera: unknown) {}
    dispose() {}

    setAnimationLoop(loop: ((time?: number) => void) | null) {
      if (loop) loop()
    }
  }

  return {
    Box3,
    Color,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace: "srgb",
    Vector3,
    WebGLRenderer,
  }
})

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => {
  class OrbitControls {
    target = { copy: vi.fn(), add: vi.fn() }
    enableDamping = false
    dampingFactor = 0
    minDistance = 0
    maxDistance = 0

    constructor(_camera: unknown, _dom: unknown) {}

    update() {}
    dispose() {}
  }

  return { OrbitControls }
})

vi.mock("@sparkjsdev/spark", async () => {
  const three = await import("three")

  class SplatMesh {
    position = new three.Vector3()
    lodScale = 1

    constructor(options?: { onLoad?: (mesh: unknown) => void }) {
      createdSplats.push(this)
      options?.onLoad?.(this)
    }

    getBoundingBox() {
      return new three.Box3()
    }

    dispose() {}
  }

  return { SplatMesh }
})

import SparkSplatViewer from "@/components/3d-route/spark-splat-viewer"

describe("SparkSplatViewer controls", () => {
  beforeEach(() => {
    createdSplats.length = 0
  })

  it("LOD スライダー変更で mesh の lodScale を更新する", async () => {
    render(<SparkSplatViewer url="/splats/sample.ply" />)

    const slider = await screen.findByLabelText("LOD スケール")
    fireEvent.change(slider, { target: { value: "1.5" } })

    expect(createdSplats[0]?.lodScale).toBeCloseTo(1.5)
  })

  it("WASD 操作のキーボードイベントを登録し、unmount時に解除する", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener")
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

    const { unmount } = render(<SparkSplatViewer url="/splats/sample.ply" />)
    await screen.findByText(/WASD/)

    expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith("keyup", expect.any(Function))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith("keyup", expect.any(Function))
  })
})
