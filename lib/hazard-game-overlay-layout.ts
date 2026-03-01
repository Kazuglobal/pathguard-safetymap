export interface LabelRect {
  x: number
  y: number
  w: number
  h: number
}

export interface FallbackCell {
  x: number
  y: number
  w: number
  h: number
}

const GRID_LEFT = 0.05
const GRID_WIDTH = 0.9
const GRID_GAP = 0.05

export function computeFallbackCell(
  index: number,
  totalDetections: number,
  canvasHeight: number,
  fontSize: number,
  pad: number
): FallbackCell {
  const gridCols = totalDetections > 6 ? 3 : 2
  const rows = Math.max(1, Math.ceil(totalDetections / gridCols))
  const col = index % gridCols
  const row = Math.floor(index / gridCols)

  const cellW = (GRID_WIDTH - GRID_GAP * (gridCols - 1)) / gridCols
  const desiredCellH = Math.max((fontSize + pad * 2) * 2 / canvasHeight, 1 / (rows + 1))
  const maxCellH = GRID_WIDTH / rows
  const cellH = Math.min(desiredCellH, maxCellH)

  const x = GRID_LEFT + col * (cellW + GRID_GAP)
  const y = Math.min(GRID_LEFT + row * cellH, GRID_LEFT + GRID_WIDTH - cellH)
  const h = Math.min(1 - y, cellH * 0.8)

  return { x, y, w: cellW, h }
}

interface FindNonOverlappingLabelYParams {
  lbX: number
  initialY: number
  lbW: number
  lbH: number
  rectBottomY: number
  canvasHeight: number
  placedLabels: LabelRect[]
  maxAttempts?: number
  gap?: number
  edgePadding?: number
}

export function findNonOverlappingLabelY({
  lbX,
  initialY,
  lbW,
  lbH,
  rectBottomY,
  canvasHeight,
  placedLabels,
  maxAttempts = 4,
  gap = 2,
  edgePadding = 2,
}: FindNonOverlappingLabelYParams): number {
  const minY = edgePadding
  const maxY = Math.max(minY, canvasHeight - lbH - edgePadding)
  const step = Math.max(1, lbH + gap)
  const clampY = (y: number) => Math.max(minY, Math.min(y, maxY))
  const overlapsAt = (y: number) =>
    placedLabels.some((p) =>
      lbX < p.x + p.w &&
      lbX + lbW > p.x &&
      y < p.y + p.h &&
      y + lbH > p.y
    )

  let y = clampY(initialY)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!overlapsAt(y)) return y
    y = clampY(y + step)
  }

  if (!overlapsAt(y)) return y

  const maxSteps = Math.ceil((maxY - minY) / step) + 1
  for (const start of [rectBottomY + gap, minY]) {
    let candidate = clampY(start)
    for (let i = 0; i <= maxSteps; i++) {
      if (!overlapsAt(candidate)) return candidate
      if (candidate >= maxY) break
      candidate = clampY(candidate + step)
    }
  }

  return maxY
}
