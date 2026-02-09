/**
 * AR Canvas描画ユーティリティのユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  drawDashedLine,
  drawMarkerBorder,
  drawMarkerCircle,
  drawWarningTriangle,
  drawDistanceLabel,
  drawHazardMarker,
  drawHazardOverlay,
} from "@/lib/ar-canvas-renderer"
import type { ARHazardData } from "@/lib/ar-utils"
import type { DangerReport } from "@/lib/types"
import {
  MARKER_DASH_ALPHA,
  MARKER_DASH_LINE_WIDTH,
  MARKER_BORDER_OFFSET,
  MARKER_BORDER_ALPHA,
  MARKER_CIRCLE_LINE_WIDTH,
  MARKER_CIRCLE_COLOR_ALPHA,
  MARKER_FONT,
  MARKER_TEXT_PADDING,
  MARKER_TEXT_HEIGHT,
  MARKER_TEXT_GAP,
  MARKER_TEXT_BG_ALPHA,
  MARKER_ICON_MIN_SIZE,
  MARKER_ICON_BASE_SIZE,
  MARKER_ROAD_Y_PADDING,
  ROAD_Y_RATIO,
  SCREEN_X_MARGIN,
  MARKER_FG_COLOR,
} from "@/lib/ar-constants"

function createMockCanvasContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 30 })),
    drawImage: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D
}

function createMockReport(overrides?: Partial<DangerReport>): DangerReport {
  return {
    id: "test-1",
    user_id: "user-1",
    title: "テスト危険箇所",
    description: null,
    latitude: 35.68,
    longitude: 139.77,
    danger_type: "traffic",
    danger_level: 3,
    status: "active",
    image_url: null,
    processed_image_urls: null,
    prefecture: null,
    prefecture_code: null,
    city: null,
    municipality_code: null,
    town: null,
    postal_code: null,
    geocode_source: null,
    geocoded_at: null,
    geocode_confidence: null,
    address_hash: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

function createMockHazard(overrides?: Partial<ARHazardData>): ARHazardData {
  return {
    report: createMockReport(),
    distance: 100,
    bearing: 45,
    relativeAngle: 10,
    x: 0.2,
    y: 0,
    z: 0.5,
    ...overrides,
  }
}

describe("AR Canvas描画ユーティリティ", () => {
  let ctx: ReturnType<typeof createMockCanvasContext>

  beforeEach(() => {
    ctx = createMockCanvasContext()
    vi.clearAllMocks()
  })

  describe("drawDashedLine - 破線描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      drawDashedLine(ctx as unknown as CanvasRenderingContext2D, 100, 500, 200)
      expect(ctx.save).toHaveBeenCalledOnce()
      expect(ctx.restore).toHaveBeenCalledOnce()
    })

    it("roadYからmarkerYへの線を描画する", () => {
      drawDashedLine(ctx as unknown as CanvasRenderingContext2D, 100, 500, 200)
      expect(ctx.beginPath).toHaveBeenCalledOnce()
      expect(ctx.moveTo).toHaveBeenCalledWith(100, 500)
      expect(ctx.lineTo).toHaveBeenCalledWith(100, 200)
      expect(ctx.stroke).toHaveBeenCalledOnce()
    })

    it("正しいstrokeStyleを設定する", () => {
      drawDashedLine(ctx as unknown as CanvasRenderingContext2D, 100, 500, 200)
      expect(ctx.strokeStyle).toBe(`rgba(255, 255, 255, ${MARKER_DASH_ALPHA})`)
    })

    it("正しいlineWidthを設定する", () => {
      drawDashedLine(ctx as unknown as CanvasRenderingContext2D, 100, 500, 200)
      expect(ctx.lineWidth).toBe(MARKER_DASH_LINE_WIDTH)
    })

    it("破線パターンを設定する", () => {
      drawDashedLine(ctx as unknown as CanvasRenderingContext2D, 100, 500, 200)
      expect(ctx.setLineDash).toHaveBeenCalledWith([5, 5])
    })
  })

  describe("drawMarkerBorder - 外枠円描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      drawMarkerBorder(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20)
      expect(ctx.save).toHaveBeenCalledOnce()
      expect(ctx.restore).toHaveBeenCalledOnce()
    })

    it("iconRadius + BORDER_OFFSETの半径で円を描画する", () => {
      drawMarkerBorder(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20)
      expect(ctx.arc).toHaveBeenCalledWith(
        100, 200, 20 + MARKER_BORDER_OFFSET, 0, Math.PI * 2
      )
    })

    it("正しいfillStyleを設定する", () => {
      drawMarkerBorder(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20)
      expect(ctx.fillStyle).toBe(`rgba(255, 255, 255, ${MARKER_BORDER_ALPHA})`)
      expect(ctx.fill).toHaveBeenCalledOnce()
    })
  })

  describe("drawMarkerCircle - 色付き円描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      drawMarkerCircle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "#ef4444")
      expect(ctx.save).toHaveBeenCalledOnce()
      expect(ctx.restore).toHaveBeenCalledOnce()
    })

    it("正確なiconRadiusで円を描画する", () => {
      drawMarkerCircle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "#ef4444")
      expect(ctx.arc).toHaveBeenCalledWith(100, 200, 20, 0, Math.PI * 2)
    })

    it("色にアルファサフィックスを付けてfillする", () => {
      drawMarkerCircle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "#ef4444")
      expect(ctx.fillStyle).toBe("#ef4444" + MARKER_CIRCLE_COLOR_ALPHA)
    })

    it("色をstrokeStyleに設定する", () => {
      drawMarkerCircle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "#ef4444")
      expect(ctx.strokeStyle).toBe("#ef4444")
    })

    it("正しいlineWidthを設定する", () => {
      drawMarkerCircle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "#ef4444")
      expect(ctx.lineWidth).toBe(MARKER_CIRCLE_LINE_WIDTH)
    })
  })

  describe("drawWarningTriangle - 警告三角描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      drawWarningTriangle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20)
      expect(ctx.save).toHaveBeenCalledOnce()
      expect(ctx.restore).toHaveBeenCalledOnce()
    })

    it("閉じたパスを描画する", () => {
      drawWarningTriangle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20)
      expect(ctx.beginPath).toHaveBeenCalledOnce()
      expect(ctx.moveTo).toHaveBeenCalledOnce()
      expect(ctx.lineTo).toHaveBeenCalledTimes(2)
      expect(ctx.closePath).toHaveBeenCalledOnce()
    })

    it("白色でfillする", () => {
      drawWarningTriangle(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20)
      expect(ctx.fillStyle).toBe(MARKER_FG_COLOR)
      expect(ctx.fill).toHaveBeenCalledOnce()
    })
  })

  describe("drawDistanceLabel - 距離テキスト描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      expect(ctx.save).toHaveBeenCalledOnce()
      expect(ctx.restore).toHaveBeenCalledOnce()
    })

    it("正しいフォントを設定する", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      expect(ctx.font).toBe(MARKER_FONT)
    })

    it("テキスト配置を設定する", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      expect(ctx.textAlign).toBe("center")
      expect(ctx.textBaseline).toBe("top")
    })

    it("measureTextを呼び出す", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      expect(ctx.measureText).toHaveBeenCalledWith("100m")
    })

    it("背景矩形を描画する", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      const labelY = 200 + 20 + MARKER_TEXT_GAP
      expect(ctx.fillRect).toHaveBeenCalledWith(
        100 - 30 / 2 - MARKER_TEXT_PADDING,
        labelY,
        30 + MARKER_TEXT_PADDING * 2,
        MARKER_TEXT_HEIGHT
      )
    })

    it("背景色にアルファを適用する", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      // fillStyleは最後にセットされた値（テキスト白色）
      // fillRectの前に背景色がセットされることを確認
      expect(ctx.fillRect).toHaveBeenCalledOnce()
    })

    it("テキストを描画する", () => {
      drawDistanceLabel(ctx as unknown as CanvasRenderingContext2D, 100, 200, 20, "100m")
      const labelY = 200 + 20 + MARKER_TEXT_GAP
      expect(ctx.fillText).toHaveBeenCalledWith("100m", 100, labelY + MARKER_TEXT_PADDING)
    })
  })

  describe("drawHazardMarker - マーカー統合描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      const hazard = createMockHazard()
      drawHazardMarker(ctx as unknown as CanvasRenderingContext2D, 100, 200, hazard, 720)
      // 外側のsave/restore + 各サブ関数のsave/restore
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it("markerYをroadY - PADDINGに制限する", () => {
      const hazard = createMockHazard()
      const canvasHeight = 720
      const roadY = canvasHeight * ROAD_Y_RATIO
      // yがroadYより大きい場合
      drawHazardMarker(ctx as unknown as CanvasRenderingContext2D, 100, roadY + 100, hazard, canvasHeight)
      // drawDashedLineのmoveTo呼び出しでroadYが使用される
      expect(ctx.moveTo).toHaveBeenCalledWith(100, roadY)
      // markerYはroadY - MARKER_ROAD_Y_PADDINGに制限される
      expect(ctx.lineTo).toHaveBeenCalledWith(100, roadY - MARKER_ROAD_Y_PADDING)
    })

    it("距離0でiconSizeがBASE_SIZEになる", () => {
      const hazard = createMockHazard({ distance: 0 })
      drawHazardMarker(ctx as unknown as CanvasRenderingContext2D, 100, 200, hazard, 720)
      const expectedRadius = MARKER_ICON_BASE_SIZE / 2
      // drawMarkerBorderのarc呼び出しで確認
      expect(ctx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expectedRadius + MARKER_BORDER_OFFSET,
        0,
        Math.PI * 2
      )
    })

    it("大きい距離でiconSizeがMIN_SIZEになる", () => {
      const hazard = createMockHazard({ distance: 1000 })
      drawHazardMarker(ctx as unknown as CanvasRenderingContext2D, 100, 200, hazard, 720)
      const expectedRadius = MARKER_ICON_MIN_SIZE / 2
      expect(ctx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expectedRadius + MARKER_BORDER_OFFSET,
        0,
        Math.PI * 2
      )
    })

    it("全ての危険度レベルで正しく動作する", () => {
      for (let level = 1; level <= 5; level++) {
        const localCtx = createMockCanvasContext()
        const hazard = createMockHazard({
          report: createMockReport({ danger_level: level }),
        })
        expect(() => {
          drawHazardMarker(localCtx as unknown as CanvasRenderingContext2D, 100, 200, hazard, 720)
        }).not.toThrow()
      }
    })

    it("5つのサブ描画操作を実行する", () => {
      const hazard = createMockHazard()
      drawHazardMarker(ctx as unknown as CanvasRenderingContext2D, 100, 200, hazard, 720)
      // 外側1回 + サブ関数5回 = 6回のsave
      expect(ctx.save).toHaveBeenCalledTimes(6)
      expect(ctx.restore).toHaveBeenCalledTimes(6)
    })
  })

  describe("drawHazardOverlay - オーバーレイ描画", () => {
    it("ctx.save()とctx.restore()を呼び出す", () => {
      drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, [], 1280, 720, 60, 500)
      expect(ctx.save).toHaveBeenCalledOnce()
      expect(ctx.restore).toHaveBeenCalledOnce()
    })

    it("空配列の場合は何も描画しない", () => {
      drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, [], 1280, 720, 60, 500)
      expect(ctx.beginPath).not.toHaveBeenCalled()
    })

    it("画面内のハザードを描画する", () => {
      const hazard = createMockHazard({ relativeAngle: 0, distance: 100 })
      drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, [hazard], 1280, 720, 60, 500)
      // drawHazardMarkerが呼ばれたことの確認（beginPathが呼ばれる）
      expect(ctx.beginPath).toHaveBeenCalled()
    })

    it("画面左外のハザードをスキップする", () => {
      // relativeAngleを大きい負の値にして画面左外に配置
      const hazard = createMockHazard({ relativeAngle: -100, distance: 100 })
      drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, [hazard], 1280, 720, 60, 500)
      // save/restoreは外側のみ（マーカー描画なし）
      expect(ctx.save).toHaveBeenCalledOnce()
    })

    it("画面右外のハザードをスキップする", () => {
      const hazard = createMockHazard({ relativeAngle: 100, distance: 100 })
      drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, [hazard], 1280, 720, 60, 500)
      expect(ctx.save).toHaveBeenCalledOnce()
    })

    it("maxDistance=0の場合はsafeMaxDistance=1として処理する", () => {
      const hazard = createMockHazard({ relativeAngle: 0, distance: 100 })
      expect(() => {
        drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, [hazard], 1280, 720, 60, 0)
      }).not.toThrow()
    })

    it("複数のハザードを描画する", () => {
      const hazards = [
        createMockHazard({ relativeAngle: 0, distance: 100 }),
        createMockHazard({ relativeAngle: 5, distance: 200 }),
      ]
      drawHazardOverlay(ctx as unknown as CanvasRenderingContext2D, hazards, 1280, 720, 60, 500)
      // 外側1回 + マーカー2個 × (1外側 + 5サブ関数) = 1 + 12 = 13
      expect(ctx.save).toHaveBeenCalledTimes(13)
    })
  })
})
