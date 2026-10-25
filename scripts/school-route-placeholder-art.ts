/**
 * 通学路の安全ニュース用プレースホルダー画像の作図（ImageMagick / AI生成なし）
 *
 * GEMINI_API_KEY が無い実行環境（スケジュール実行のクラウドセッション等）で、
 * 記事が参照する画像を「無地のグラデーション」ではなく、仕様書 Step 5 の要件を
 * 満たした抽象イラストとして用意するためのフォールバック。
 *
 *   - 事故現場・不審者本人・負傷は描かない
 *   - 日本の通学シーン要素（黄色い帽子・ランドセル・横断歩道・見守り）
 *   - カテゴリカラーに合わせたトーン
 *   - 文字・数字・顔は一切描かない
 *   - slug ごとに構図が変わる（使い回しではない）
 *
 * これはあくまで暫定画像であり、`scripts/image-placeholders.json` に登録される。
 * GEMINI_API_KEY がある環境で `generate-missing-images.ts` を実行すると、
 * 登録済みのプレースホルダーは本生成の画像で上書きされる。
 */

import { execFileSync } from "child_process"
import crypto from "crypto"
import fs from "fs"
import path from "path"

const WIDTH = 1200
const HEIGHT = 630

export type PlaceholderVariant = "thumbnail" | "figure"

interface Palette {
  /** 空のグラデーション（上→下） */
  skyTop: string
  skyBottom: string
  /** 歩道の帯 */
  walk: string
  /** 車道 */
  road: string
  roadEdge: string
  /** カテゴリのアクセント */
  accent: string
  /** ランドセルなどの小物 */
  pack: string
  packAlt: string
}

/** accident=赤系警告 / suspicious=オレンジ警戒 / infrastructure=青の安心 / community=緑の温かみ */
const PALETTES: Record<string, Palette> = {
  accident: {
    skyTop: "#8E2230", skyBottom: "#E7A79B", walk: "#8E4038", road: "#55606E",
    roadEdge: "#6B7684", accent: "#EF4444", pack: "#B4472F", packAlt: "#8C3421",
  },
  suspicious: {
    skyTop: "#95490D", skyBottom: "#F6C58A", walk: "#9A5A20", road: "#5C5A58",
    roadEdge: "#726F6C", accent: "#F97316", pack: "#C2641F", packAlt: "#8F4612",
  },
  infrastructure: {
    skyTop: "#1D3C86", skyBottom: "#8FB9EE", walk: "#2A4D8F", road: "#55606E",
    roadEdge: "#6B7684", accent: "#3B82F6", pack: "#2F6FB4", packAlt: "#1F4F85",
  },
  policy: {
    skyTop: "#4C2A8C", skyBottom: "#C3ACEF", walk: "#4B2C8C", road: "#585462",
    roadEdge: "#6E6A78", accent: "#8B5CF6", pack: "#6D4AAE", packAlt: "#4E3280",
  },
  community: {
    skyTop: "#1B6B3A", skyBottom: "#AEE6BD", walk: "#246B3C", road: "#56605A",
    roadEdge: "#6C766F", accent: "#22C55E", pack: "#2E8B57", packAlt: "#1F6540",
  },
}

const CAP = "#F7D13D"
const BODY = "#374151"
const LIMB = "#1F2937"
const HEAD = "#2F3A4A"
const STRIPE = "#F3F4F6"

/** slug から決定的な擬似乱数を作る（同じ slug なら毎回同じ絵） */
function makeRandom(seed: string): () => number {
  let state = parseInt(crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) || 1
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return state / 0x100000000
  }
}

const draw = (shape: string): string[] => ["-draw", shape]
const fill = (color: string): string[] => ["-fill", color]

/** 後ろ姿の児童（黄色い帽子＋ランドセル）。顔は描かない */
function child(x: number, groundY: number, scale: number, packColor: string, packShade: string): string[] {
  const w = Math.round(58 * scale)
  const h = Math.round(94 * scale)
  const legW = Math.round(20 * scale)
  const legH = Math.round(62 * scale)
  // 胴は脚の上に重ねて置く（胴で脚を塗りつぶさない）
  const top = groundY - legH + Math.round(14 * scale) - h
  const headR = Math.round(28 * scale)
  const headCy = top - headR + Math.round(6 * scale)
  const packInset = Math.round(8 * scale)

  return [
    // 脚
    ...fill(LIMB),
    ...draw(`roundrectangle ${x - legW - 4},${groundY - legH} ${x - 4},${groundY} 7,7`),
    ...draw(`roundrectangle ${x + 4},${groundY - legH} ${x + legW + 4},${groundY} 7,7`),
    // 胴
    ...fill(BODY),
    ...draw(`roundrectangle ${x - w / 2},${top} ${x + w / 2},${top + h} ${Math.round(16 * scale)},${Math.round(16 * scale)}`),
    // ランドセル
    ...fill(packColor),
    ...draw(`roundrectangle ${x - w / 2 + packInset},${top + packInset} ${x + w / 2 - packInset},${top + h - packInset * 2} ${Math.round(12 * scale)},${Math.round(12 * scale)}`),
    ...fill(packShade),
    ...draw(`roundrectangle ${x - w / 2 + packInset},${top + packInset} ${x + w / 2 - packInset},${top + packInset + Math.round(16 * scale)} 6,6`),
    // 頭（顔は描かない）
    ...fill(HEAD),
    ...draw(`circle ${x},${headCy} ${x},${headCy - headR}`),
    // 黄色い帽子
    ...fill(CAP),
    ...draw(`ellipse ${x},${headCy} ${Math.round(headR * 1.22)},${Math.round(headR * 1.07)} 180,360`),
    ...draw(`ellipse ${x},${headCy + Math.round(2 * scale)} ${Math.round(headR * 1.57)},${Math.round(headR * 0.28)} 180,360`),
  ]
}

/** 見守りの大人（反射ベスト）。顔は描かない */
function guardian(x: number, groundY: number, accent: string): string[] {
  const top = groundY - 128
  return [
    ...fill(LIMB),
    ...draw(`roundrectangle ${x - 26},${groundY - 74} ${x - 4},${groundY} 8,8`),
    ...draw(`roundrectangle ${x + 4},${groundY - 74} ${x + 26},${groundY} 8,8`),
    ...fill(BODY),
    ...draw(`roundrectangle ${x - 38},${top} ${x + 38},${top + 86} 18,18`),
    ...fill(CAP),
    ...draw(`roundrectangle ${x - 30},${top + 12} ${x + 30},${top + 78} 12,12`),
    ...fill(accent),
    ...draw(`roundrectangle ${x - 30},${top + 40} ${x + 30},${top + 52} 4,4`),
    ...fill(HEAD),
    ...draw(`circle ${x},${top - 24} ${x},${top - 56}`),
  ]
}

/** カテゴリごとの右手のモチーフ */
function motif(category: string, cx: number, groundY: number, palette: Palette, rnd: () => number): string[] {
  // 支柱の上に載る看板・信号が画面上端で切れないよう下限を設ける
  const poleTop = Math.max(150, groundY - 236 - Math.round(rnd() * 26))
  switch (category) {
    case "accident":
      // 信号機（赤が点灯）
      return [
        ...fill("#9AA6B8"), ...draw(`rectangle ${cx - 8},${poleTop} ${cx + 8},${groundY}`),
        ...fill("#1F2937"), ...draw(`roundrectangle ${cx - 48},${poleTop - 96} ${cx + 48},${poleTop + 2} 12,12`),
        ...fill(palette.accent), ...draw(`circle ${cx},${poleTop - 68} ${cx},${poleTop - 51}`),
        ...fill("#4B5563"), ...draw(`circle ${cx},${poleTop - 32} ${cx},${poleTop - 15}`),
      ]
    case "suspicious":
      // 「こども110番の家」を思わせる駆け込み先（看板は無地）
      return [
        ...fill("#E8E2D8"), ...draw(`rectangle ${cx - 120},${groundY - 190} ${cx + 120},${groundY}`),
        ...fill(palette.accent), ...draw(`polygon ${cx - 150},${groundY - 190} ${cx + 150},${groundY - 190} ${cx},${groundY - 268}`),
        ...fill("#F7F4EF"), ...draw(`roundrectangle ${cx - 42},${groundY - 118} ${cx + 42},${groundY} 6,6`),
        ...fill(CAP), ...draw(`roundrectangle ${cx - 34},${groundY - 172} ${cx + 34},${groundY - 134} 6,6`),
      ]
    case "infrastructure":
      // 見守りカメラ
      return [
        ...fill("#9AA6B8"), ...draw(`rectangle ${cx - 9},${poleTop} ${cx + 9},${groundY}`),
        ...fill("#1F2937"), ...draw(`roundrectangle ${cx - 86},${poleTop - 46} ${cx + 30},${poleTop + 8} 14,14`),
        ...fill("#111827"), ...draw(`roundrectangle ${cx - 110},${poleTop - 36} ${cx - 80},${poleTop - 2} 8,8`),
        ...fill(palette.accent), ...draw(`circle ${cx - 95},${poleTop - 19} ${cx - 95},${poleTop - 8}`),
      ]
    case "community":
      // 見守りボランティアの旗
      return [
        ...fill("#9AA6B8"), ...draw(`rectangle ${cx - 7},${poleTop + 40} ${cx + 7},${groundY}`),
        ...fill(palette.accent), ...draw(`polygon ${cx + 7},${poleTop + 40} ${cx + 160},${poleTop + 86} ${cx + 7},${poleTop + 132}`),
        ...fill(CAP), ...draw(`circle ${cx},${poleTop + 28} ${cx},${poleTop + 6}`),
      ]
    default:
      // policy: 無地の掲示板
      return [
        ...fill("#9AA6B8"),
        ...draw(`rectangle ${cx - 58},${groundY - 150} ${cx - 44},${groundY}`),
        ...draw(`rectangle ${cx + 44},${groundY - 150} ${cx + 58},${groundY}`),
        ...fill("#1F2937"), ...draw(`roundrectangle ${cx - 110},${groundY - 290} ${cx + 110},${groundY - 140} 14,14`),
        ...fill(palette.accent), ...draw(`roundrectangle ${cx - 94},${groundY - 274} ${cx + 94},${groundY - 156} 8,8`),
      ]
  }
}

/** 空の光（夕景・朝景の抜け）。平面的な図に見せないための一番効く要素 */
function sunGlow(rnd: () => number): string[] {
  const rollX = Math.round((rnd() - 0.5) * 420)
  const rollY = -Math.round(rnd() * 90)
  return [
    "(", "-size", `${WIDTH}x${HEIGHT}`, "radial-gradient:rgba(255,226,180,0.80)-rgba(255,226,180,0)",
    "-roll", `${rollX >= 0 ? "+" : ""}${rollX}${rollY >= 0 ? "+" : ""}${rollY}`, ")",
    "-compose", "screen", "-composite", "-compose", "over",
  ]
}

/** 遠景の雲 */
function clouds(rnd: () => number): string[] {
  const args: string[] = [...fill("rgba(255,255,255,0.16)")]
  const count = 2 + Math.round(rnd() * 2)
  for (let i = 0; i < count; i++) {
    const cx = Math.round(rnd() * WIDTH)
    const cy = Math.round(70 + rnd() * 130)
    const rx = Math.round(80 + rnd() * 80)
    args.push(...draw(`ellipse ${cx},${cy} ${rx},${Math.round(rx * 0.2)} 0,360`))
    args.push(...draw(`ellipse ${cx + Math.round(rx * 0.5)},${cy + 16} ${Math.round(rx * 0.7)},${Math.round(rx * 0.15)} 0,360`))
  }
  return args
}

/** 遠景の住宅街と街路樹（通学路の文脈を一目で出す） */
function skyline(horizon: number, palette: Palette, rnd: () => number): string[] {
  const args: string[] = []
  const far = "#3B2E57"
  const roof = "#2F2448"
  let x = -40
  while (x < WIDTH) {
    const w = 90 + Math.round(rnd() * 90)
    const h = 70 + Math.round(rnd() * 90)
    const top = horizon - h
    args.push(...fill(far), ...draw(`rectangle ${x},${top} ${x + w},${horizon}`))
    if (rnd() > 0.45) {
      args.push(...fill(roof), ...draw(`polygon ${x},${top} ${x + w / 2},${top - 38} ${x + w},${top}`))
    }
    // 灯りの点いた窓（夕方の通学時間帯の気配）
    args.push(...fill("rgba(255,228,176,0.45)"))
    for (let wy = top + 22; wy < horizon - 30; wy += 46) {
      for (let wx = x + 18; wx < x + w - 24; wx += 44) {
        if (rnd() > 0.45) args.push(...draw(`rectangle ${wx},${wy} ${wx + 18},${wy + 22}`))
      }
    }
    x += w + 10 + Math.round(rnd() * 26)
  }
  // 街路樹
  const trees = 2 + Math.round(rnd() * 2)
  for (let i = 0; i < trees; i++) {
    // 主役（児童）の立ち位置に重ならない範囲に植える
    const tx = rnd() > 0.5
      ? Math.round(470 + rnd() * (WIDTH - 540))
      : Math.round(40 + rnd() * 90)
    const r = 34 + Math.round(rnd() * 18)
    args.push(...fill("#3B4A2E"), ...draw(`rectangle ${tx - 7},${horizon - r} ${tx + 7},${horizon}`))
    args.push(...fill("#2F5E42"), ...draw(`circle ${tx},${horizon - r - 20} ${tx},${horizon - r - 20 - r}`))
    args.push(...fill("#36694A"), ...draw(`circle ${tx + Math.round(r * 0.6)},${horizon - r - 4} ${tx + Math.round(r * 0.6)},${horizon - r - 4 - Math.round(r * 0.72)}`))
  }
  void palette
  return args
}

/** 足元の影（接地させると立体に見える） */
function groundShadow(x: number, y: number, rx: number): string[] {
  return [...fill("rgba(0,0,0,0.22)"), ...draw(`ellipse ${x},${y} ${rx},${Math.round(rx * 0.26)} 0,360`)]
}

function vignette(): string[] {
  return ["(", "-size", `${WIDTH}x${HEIGHT}`, "radial-gradient:rgba(0,0,0,0)-rgba(0,0,0,0.26)", ")", "-compose", "over", "-composite"]
}

function thumbnailArgs(category: string, seed: string): string[] {
  const palette = PALETTES[category] ?? PALETTES.policy
  const rnd = makeRandom(seed)
  const horizon = 396 + Math.round(rnd() * 22)
  const walkBottom = horizon + 44
  const groundY = horizon + 30
  const args: string[] = ["-size", `${WIDTH}x${HEIGHT}`, `gradient:${palette.skyTop}-${palette.skyBottom}`]

  args.push(...sunGlow(rnd))
  args.push(...clouds(rnd))
  args.push(...skyline(horizon, palette, rnd))

  // 歩道と車道
  args.push(...fill(palette.walk), ...draw(`rectangle 0,${horizon} ${WIDTH},${walkBottom}`))
  args.push(...fill("rgba(255,255,255,0.10)"), ...draw(`rectangle 0,${horizon} ${WIDTH},${horizon + 7}`))
  args.push(...fill(palette.road), ...draw(`rectangle 0,${walkBottom} ${WIDTH},${HEIGHT}`))
  args.push(...fill(palette.roadEdge), ...draw(`rectangle 0,${walkBottom} ${WIDTH},${walkBottom + 14}`))

  // 横断歩道（手前ほど広がる）
  const stripes = 6
  const gap = WIDTH / stripes
  const skew = 14 + Math.round(rnd() * 16)
  args.push(...fill(STRIPE))
  for (let i = 0; i < stripes; i++) {
    const x = Math.round(i * gap + 50)
    const spread = Math.round((i - stripes / 2) * skew)
    args.push(...draw(`polygon ${x},${walkBottom + 46} ${x + 90},${walkBottom + 46} ${x + 90 + spread},${HEIGHT} ${x + spread},${HEIGHT}`))
  }
  // 路面の濡れた反射（手前を少し明るく）
  args.push(...fill("rgba(255,255,255,0.05)"), ...draw(`rectangle 0,${HEIGHT - 70} ${WIDTH},${HEIGHT}`))

  // 児童（1〜2人）と、community のみ見守りの大人
  const baseX = 210 + Math.round(rnd() * 90)
  args.push(...groundShadow(baseX, groundY + 4, 44))
  args.push(...child(baseX, groundY, 1, palette.pack, palette.packAlt))
  if (rnd() > 0.35) {
    const x2 = baseX + 112 + Math.round(rnd() * 26)
    args.push(...groundShadow(x2, groundY + 10, 36))
    args.push(...child(x2, groundY + 6, 0.8, palette.packAlt, palette.pack))
  }
  if (category === "community") {
    args.push(...groundShadow(baseX + 240, groundY + 4, 48))
    args.push(...guardian(baseX + 240, groundY, palette.accent))
  }

  args.push(...motif(category, 900 + Math.round(rnd() * 90), groundY, palette, rnd))
  args.push(...vignette())
  return args
}

/** 解説図版用: 3枚の無地パネルを矢印でつないだピクトグラム的な骨格 */
function figureArgs(category: string, seed: string): string[] {
  const palette = PALETTES[category] ?? PALETTES.policy
  const rnd = makeRandom(seed)
  const args: string[] = ["-size", `${WIDTH}x${HEIGHT}`, `gradient:${palette.skyBottom}-#FFFFFF`]
  const panelY = 150
  const panelH = 330
  const panelW = 320
  const gapX = 50
  const startX = (WIDTH - (panelW * 3 + gapX * 2)) / 2

  for (let i = 0; i < 3; i++) {
    const x = Math.round(startX + i * (panelW + gapX))
    const cx = Math.round(x + panelW / 2)
    const groundY = panelY + panelH - 54

    // 影 → パネル → パネル内の空
    args.push(...fill("rgba(0,0,0,0.16)"), ...draw(`roundrectangle ${x + 6},${panelY + 10} ${x + panelW + 6},${panelY + panelH + 10} 24,24`))
    args.push(...fill("#FFFFFF"), ...draw(`roundrectangle ${x},${panelY} ${x + panelW},${panelY + panelH} 24,24`))
    args.push(...fill(`${palette.skyBottom}`), ...draw(`roundrectangle ${x + 10},${panelY + 24} ${x + panelW - 10},${panelY + panelH - 16} 16,16`))
    args.push(...fill(palette.walk), ...draw(`rectangle ${x + 10},${groundY} ${x + panelW - 10},${panelY + panelH - 16}`))
    args.push(...fill(palette.accent), ...draw(`roundrectangle ${x},${panelY} ${x + panelW},${panelY + 14} 7,7`))

    // 手順ごとに場面を変える（①家の前 → ②歩道のきわ → ③横断歩道の上）
    if (i === 0) {
      args.push(...fill("#E8E2D8"), ...draw(`rectangle ${x + 28},${groundY - 96} ${x + 118},${groundY}`))
      args.push(...fill(palette.walk), ...draw(`polygon ${x + 16},${groundY - 96} ${x + 130},${groundY - 96} ${x + 73},${groundY - 142}`))
    } else if (i === 1) {
      args.push(...fill(palette.roadEdge), ...draw(`rectangle ${x + 10},${groundY} ${x + panelW - 10},${groundY + 12}`))
      args.push(...fill("#9AA6B8"), ...draw(`rectangle ${x + panelW - 86},${groundY - 150} ${x + panelW - 74},${groundY}`))
      args.push(...fill("#1F2937"), ...draw(`roundrectangle ${x + panelW - 112},${groundY - 196} ${x + panelW - 48},${groundY - 146} 8,8`))
      args.push(...fill(palette.accent), ...draw(`circle ${x + panelW - 80},${groundY - 171} ${x + panelW - 80},${groundY - 160}`))
    } else {
      args.push(...fill(palette.road), ...draw(`rectangle ${x + 10},${groundY - 10} ${x + panelW - 10},${groundY + 32}`))
      args.push(...fill(STRIPE))
      for (let s = 0; s < 4; s++) {
        const sx = x + 24 + s * 74
        args.push(...draw(`roundrectangle ${sx},${groundY - 4} ${sx + 44},${groundY + 26} 5,5`))
      }
    }

    args.push(...groundShadow(cx, groundY + 6, 32))
    if (i === 2 && category === "community") {
      args.push(...guardian(cx, groundY, palette.accent))
    } else {
      args.push(...child(cx, groundY, 0.78, i === 1 ? palette.packAlt : palette.pack, palette.pack))
    }

    // 手順の番号は数字を書かずドットの数で示す（画像内に文字・数字は入れない）
    for (let d = 0; d <= i; d++) {
      args.push(...fill(palette.accent), ...draw(`circle ${x + 44 + d * 40},${panelY + 62} ${x + 44 + d * 40},${panelY + 46}`))
    }

    if (i < 2) {
      const ax = x + panelW + gapX / 2
      args.push(...fill(palette.walk), ...draw(`polygon ${ax - 16},${panelY + panelH / 2 - 18} ${ax + 16},${panelY + panelH / 2} ${ax - 16},${panelY + panelH / 2 + 18}`))
    }
  }
  // 下端に横断歩道の帯（記事との連続性）
  args.push(...fill(palette.road), ...draw(`rectangle 0,${HEIGHT - 60} ${WIDTH},${HEIGHT}`))
  args.push(...fill(STRIPE))
  for (let i = 0; i < 8; i++) {
    const x = Math.round(i * (WIDTH / 8) + 20 + rnd() * 8)
    args.push(...draw(`roundrectangle ${x},${HEIGHT - 44} ${x + 84},${HEIGHT - 16} 6,6`))
  }
  return args
}

export function hasImageMagick(): boolean {
  try {
    execFileSync("convert", ["--version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/**
 * プレースホルダー画像を JPEG で書き出す。
 * 記事側の参照は .jpg に統一されているため、出力も JPEG 固定。
 */
export function drawPlaceholder(options: {
  targetPath: string
  category: string
  seed: string
  variant?: PlaceholderVariant
}): void {
  const { targetPath, category, seed, variant = "thumbnail" } = options
  if (!targetPath.toLowerCase().endsWith(".jpg")) {
    throw new Error(`プレースホルダーの出力は .jpg のみ対応（受け取った値: ${targetPath}）`)
  }
  const args = variant === "figure" ? figureArgs(category, seed) : thumbnailArgs(category, seed)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.tmp.jpg`
  execFileSync("convert", [...args, "-quality", "88", tmp], { stdio: "pipe" })
  fs.renameSync(tmp, targetPath)
}
