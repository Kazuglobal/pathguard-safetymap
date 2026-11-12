// =============================================
// きけんハンター プロンプトの「位置の書き方」 (純粋・文字列のみ)
// AI ごとに得意な座標の形がちがうので、プロンプトの該当部分だけを差し替える。
//  - "box2d": Gemini が学習で慣れた box_2d [ymin,xmin,ymax,xmax] / focus [y,x](0〜1000)
//  - "region": 旧形式 {x,y,w,h}(0〜1)。切り戻し用。
//  - { pixels }: Claude。ピクセル座標 box [x1,y1,x2,y2] / focus [x,y] がいちばん正確
//    (公式: 0〜1000 などの正規化座標は苦手)。画像の大きさをプロンプトに書く。
// 受け取り側: ai-schema.ts が3つとも正規化座標へ直す(pixels は validateHunterResponse の pixelSize)。
// =============================================

import type { HunterCoordFormat } from "@/lib/hunter/ai-request-schema"
import type { ImageSize } from "@/lib/vision/image-size"

export type HunterPromptCoords = HunterCoordFormat | { readonly pixels: ImageSize }

function isPixels(coords: HunterPromptCoords): coords is { readonly pixels: ImageSize } {
  return typeof coords === "object" && coords !== null
}

/** 枠の書き方。採点は focus のまわりの小さい当たり枠で行うので、focus の正確さが要。 */
export function coordSection(coords: HunterPromptCoords): string {
  if (coords === "region") {
    return `【region(bbox)の正確さ】
- x,y はその危険「状況」が実際に写っている場所の左上、w,h はその範囲(画像左上が0,0、右下が1,1の正規化座標)。`
  }
  const focusLines = (box: string) => `- 採点は focus のまわりの小さい範囲で行う。focus は枠の中心ではなく、危険の原因そのものの上に置く。
- 安全の工夫(safePoints)も ${box} で囲み、focus をその工夫そのものの上に置く。`
  if (isPixels(coords)) {
    const { width, height } = coords.pixels
    return `【box(枠)と focus(見るべき1点)の正確さ】
- この画像は 幅 ${width} ピクセル × 高さ ${height} ピクセル。左上が (0, 0)、右へ x、下へ y が増える。
- box は [x1, y1, x2, y2](左上の角と右下の角)を、この画像のピクセル座標の整数で書き、その危険「状況」が実際に写っている範囲を囲む。
- focus は [x, y](ピクセル座標の整数)。子どもが「ここ！」と指でさすべき いちばん大事な1点(例: 角を作っている へいの はし / 車のかげの すき間 / わたる場所の まんなか)。focus は必ず box の内側に置く。
${focusLines("box")}`
  }
  return `【box_2d(枠)と focus(見るべき1点)の正確さ】
- box_2d は [ymin, xmin, ymax, xmax]。画像の左上を0、右下を1000とした 0〜1000 の整数で、その危険「状況」が実際に写っている範囲を囲む。
- focus は [y, x](0〜1000 の整数)。子どもが「ここ！」と指でさすべき いちばん大事な1点(例: 角を作っている へいの はし / 車のかげの すき間 / わたる場所の まんなか)。focus は必ず box_2d の内側に置く。
${focusLines("box_2d")}`
}

/** JSON の例の位置の部分(例の場所は どの形式でも同じ: 左上 x0.40,y0.52 / 幅0.18,高さ0.20 / focus x0.42,y0.61)。 */
export function coordExample(coords: HunterPromptCoords): string {
  if (coords === "region") return `"region": { "x": 0.40, "y": 0.52, "w": 0.18, "h": 0.20 }`
  if (isPixels(coords)) {
    const { width: w, height: h } = coords.pixels
    const px = (v: number, size: number) => Math.round(v * size)
    return `"box": [${px(0.4, w)}, ${px(0.52, h)}, ${px(0.58, w)}, ${px(0.72, h)}],
      "focus": [${px(0.42, w)}, ${px(0.61, h)}]`
  }
  return `"box_2d": [520, 400, 720, 580],
      "focus": [610, 420]`
}

/** 枠の項目名(safePoints の説明で使う)。 */
export function boxKey(coords: HunterPromptCoords): string {
  if (coords === "region") return "region"
  return isPixels(coords) ? "box" : "box_2d"
}

/** focus を出させる形式か(旧 region は focus なし)。 */
export function hasFocus(coords: HunterPromptCoords): boolean {
  return coords !== "region"
}
