/**
 * 危険レポートの画像生成プロンプト末尾に付ける、検出ハザードの位置ヒント。
 * - 数値bbox(正規化座標)は幾何精度のために維持し、自然言語のフレーム位置語を併記する。
 * - ラベルは /api/hazard-game/analyze 由来で、生成プロンプト本文(Step 2)の選定と食い違い得るため、
 *   『ヒントに過ぎず本文が優先』を明文化して二重ラベル化を防ぐ。
 */
export type RegionHazard = {
  readonly type?: string
  readonly bbox?: { x?: number; y?: number; width?: number; height?: number } | null
}

const colWord = (cx: number): string => (cx < 1 / 3 ? "left" : cx < 2 / 3 ? "center" : "right")
const rowWord = (cy: number): string => (cy < 1 / 3 ? "top" : cy < 2 / 3 ? "middle" : "bottom")

function gridWord(cx: number, cy: number): string {
  const row = rowWord(cy)
  const col = colWord(cx)
  return row === "middle" && col === "center" ? "center" : `${row}-${col}`
}

export function buildRegionConstraints(hazards: readonly RegionHazard[]): string {
  if (!Array.isArray(hazards) || hazards.length === 0) return ""
  const lines = hazards
    .filter((h) => h?.bbox && typeof h.bbox === "object")
    .map((h, i) => {
      const b = h.bbox as { x?: number; y?: number; width?: number; height?: number }
      const x = Number(b.x ?? 0)
      const y = Number(b.y ?? 0)
      const w = Number(b.width ?? 0.25)
      const hgt = Number(b.height ?? 0.2)
      const cx = Math.max(0, Math.min(1, x + w / 2))
      const cy = Math.max(0, Math.min(1, y + hgt / 2))
      return `${i + 1}) label='${h.type ?? "hazard"}' bbox=[${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${hgt.toFixed(3)}] — roughly the ${gridWord(cx, cy)} of the frame.`
    })
  if (lines.length === 0) return ""
  return [
    "Detected hazard positions (placement hints only — mark ONLY the hazards selected in the main instruction above; if a hint conflicts with the main instruction, the main instruction wins):",
    ...lines,
    "Anchor each overlay to the real object at its position; never move or re-render the object itself.",
  ].join(" ")
}
