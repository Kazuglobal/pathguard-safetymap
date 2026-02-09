// AR Canvas描画ユーティリティ（純粋関数）

import { formatDistance, type ARHazardData } from "@/lib/ar-utils"
import { getDangerLevelColor, hexToRgba } from "@/lib/ar-display-utils"
import {
  SCREEN_X_SCALE,
  SCREEN_Y_OFFSET,
  SCREEN_Y_SCALE,
  SCREEN_X_MARGIN,
  ROAD_Y_RATIO,
  MARKER_ICON_MIN_SIZE,
  MARKER_ICON_BASE_SIZE,
  MARKER_ICON_DISTANCE_DIVISOR,
  MARKER_DASH_PATTERN,
  MARKER_DASH_LINE_WIDTH,
  MARKER_DASH_ALPHA,
  MARKER_BORDER_OFFSET,
  MARKER_BORDER_ALPHA,
  MARKER_CIRCLE_LINE_WIDTH,
  MARKER_CIRCLE_COLOR_ALPHA,
  MARKER_TRIANGLE_TOP,
  MARKER_TRIANGLE_BOTTOM,
  MARKER_TRIANGLE_WIDTH,
  MARKER_FONT,
  MARKER_TEXT_PADDING,
  MARKER_TEXT_HEIGHT,
  MARKER_TEXT_GAP,
  MARKER_TEXT_BG_ALPHA,
  MARKER_ROAD_Y_PADDING,
  MARKER_FG_COLOR,
} from "@/lib/ar-constants"

const markerCircleColorOpacityRaw = Number.parseInt(MARKER_CIRCLE_COLOR_ALPHA, 16) / 255
const markerCircleColorOpacity = Number.isFinite(markerCircleColorOpacityRaw)
  ? Math.max(0, Math.min(1, markerCircleColorOpacityRaw))
  : 1

/**
 * 道路からマーカーへの破線を描画
 */
export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  roadY: number,
  markerY: number
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, roadY)
  ctx.lineTo(x, markerY)
  ctx.strokeStyle = `rgba(255, 255, 255, ${MARKER_DASH_ALPHA})`
  ctx.lineWidth = MARKER_DASH_LINE_WIDTH
  ctx.setLineDash(MARKER_DASH_PATTERN as number[])
  ctx.stroke()
  ctx.restore()
}

/**
 * マーカーの白い外枠円を描画
 */
export function drawMarkerBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  iconRadius: number
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, iconRadius + MARKER_BORDER_OFFSET, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${MARKER_BORDER_ALPHA})`
  ctx.fill()
  ctx.restore()
}

/**
 * マーカーの色付き円とストロークを描画
 */
export function drawMarkerCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  iconRadius: number,
  color: string
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, iconRadius, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(color, markerCircleColorOpacity)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = MARKER_CIRCLE_LINE_WIDTH
  ctx.stroke()
  ctx.restore()
}

/**
 * 警告三角アイコンを描画
 */
export function drawWarningTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  iconRadius: number
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, y - iconRadius * MARKER_TRIANGLE_TOP)
  ctx.lineTo(x - iconRadius * MARKER_TRIANGLE_WIDTH, y + iconRadius * MARKER_TRIANGLE_BOTTOM)
  ctx.lineTo(x + iconRadius * MARKER_TRIANGLE_WIDTH, y + iconRadius * MARKER_TRIANGLE_BOTTOM)
  ctx.closePath()
  ctx.fillStyle = MARKER_FG_COLOR
  ctx.fill()
  ctx.restore()
}

/**
 * 距離テキストを背景付きで描画
 */
export function drawDistanceLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  iconRadius: number,
  distanceText: string
): void {
  ctx.save()
  ctx.font = MARKER_FONT
  ctx.textAlign = "center"
  ctx.textBaseline = "top"

  const textMetrics = ctx.measureText(distanceText)
  const textWidth = textMetrics.width
  const labelY = y + iconRadius + MARKER_TEXT_GAP

  ctx.fillStyle = `rgba(0, 0, 0, ${MARKER_TEXT_BG_ALPHA})`
  ctx.fillRect(
    x - textWidth / 2 - MARKER_TEXT_PADDING,
    labelY,
    textWidth + MARKER_TEXT_PADDING * 2,
    MARKER_TEXT_HEIGHT
  )

  ctx.fillStyle = MARKER_FG_COLOR
  ctx.fillText(distanceText, x, labelY + MARKER_TEXT_PADDING)
  ctx.restore()
}

/**
 * 危険個所マーカーを描画
 */
export function drawHazardMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hazard: ARHazardData,
  canvasHeight: number
): void {
  ctx.save()

  const { report, distance } = hazard
  const roadY = canvasHeight * ROAD_Y_RATIO
  const markerY = Math.min(y, roadY - MARKER_ROAD_Y_PADDING)
  const iconSize = Math.max(
    MARKER_ICON_MIN_SIZE,
    MARKER_ICON_BASE_SIZE - distance / MARKER_ICON_DISTANCE_DIVISOR
  )
  const iconRadius = iconSize / 2
  const color = getDangerLevelColor(report.danger_level)

  drawDashedLine(ctx, x, roadY, markerY)
  drawMarkerBorder(ctx, x, markerY, iconRadius)
  drawMarkerCircle(ctx, x, markerY, iconRadius, color)
  drawWarningTriangle(ctx, x, markerY, iconRadius)
  drawDistanceLabel(ctx, x, markerY, iconRadius, formatDistance(distance))

  ctx.restore()
}

/**
 * 全ての危険個所マーカーをキャンバスに描画
 */
export function drawHazardOverlay(
  ctx: CanvasRenderingContext2D,
  hazards: ARHazardData[],
  canvasWidth: number,
  canvasHeight: number,
  fov: number,
  maxDistance: number
): void {
  ctx.save()

  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const safeMaxDistance = Math.max(1, maxDistance)

  hazards.forEach((hazard) => {
    const screenX =
      centerX +
      (hazard.relativeAngle / fov) * canvasWidth * SCREEN_X_SCALE

    const normalizedDistance = Math.min(hazard.distance / safeMaxDistance, 1)
    const screenY = centerY + (normalizedDistance - SCREEN_Y_OFFSET) * canvasHeight * SCREEN_Y_SCALE

    // 画面外の場合は描画しない
    if (screenX < -SCREEN_X_MARGIN || screenX > canvasWidth + SCREEN_X_MARGIN) {
      return
    }

    drawHazardMarker(ctx, screenX, screenY, hazard, canvasHeight)
  })

  ctx.restore()
}
