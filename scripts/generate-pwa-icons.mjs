// PWAアイコン生成スクリプト
//
// 使い方:
//   node scripts/generate-pwa-icons.mjs
//
// 入力: assets/pwa/icon-source.png (1024x1024 推奨。Codex等で生成した正式アート)
//   - 存在すればそれを元に全サイズを生成する
//   - 存在しなければ、下記の暫定SVG(たんけんノート調)から生成する(API不使用)
//
// 出力(public/):
//   icon-192.png / icon-512.png            … purpose "any"(全面)
//   icon-maskable-192.png / icon-maskable-512.png … セーフゾーン80%版
//   apple-touch-icon.png (180x180)          … iOSホーム画面用(不透明背景)
//   badge-96.png                            … Android通知バッジ用(白モノクロ・透過)
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE_PNG = resolve(ROOT, "assets/pwa/icon-source.png")
const PUBLIC_DIR = resolve(ROOT, "public")

const BRAND_COLOR = "#0ea5e9" // app/layout.tsx viewport.themeColor と一致させる

// 暫定アイコンの中身: 白いシールド + 通学路(点線の道) + ピン + 出発点
const FALLBACK_CONTENT = `
  <path d="M512 176 L788 264 V520 C788 700 664 812 512 872 C360 812 236 700 236 520 V264 Z"
        fill="#ffffff" stroke="#0b7fb8" stroke-width="20" stroke-linejoin="round"/>
  <path d="M368 744 C300 640 420 580 512 540 C620 494 680 430 640 340"
        fill="none" stroke="#fbbf24" stroke-width="46" stroke-linecap="round"
        stroke-dasharray="2 88"/>
  <path d="M640 232 C588 232 548 272 548 324 C548 396 640 480 640 480 C640 480 732 396 732 324 C732 272 692 232 640 232 Z"
        fill="#f43f5e" stroke="#be123c" stroke-width="14" stroke-linejoin="round"/>
  <circle cx="640" cy="326" r="34" fill="#ffffff"/>
  <circle cx="368" cy="756" r="40" fill="#22c55e" stroke="#15803d" stroke-width="12"/>
`

// maskable はOS側で円形等に切り抜かれるため、背景を全面(角丸なし)に敷き、
// 中身だけをセーフゾーン(80%)へ縮小した専用版を描く。
// PNGを単色パディングすると背景グラデーションとの間に継ぎ目が見えるため、
// SVGの段階で作り分ける
function fallbackSvg({ maskable = false } = {}) {
  const bgRect = maskable
    ? `<rect width="1024" height="1024" fill="url(#bg)"/>`
    : `<rect width="1024" height="1024" rx="224" fill="url(#bg)"/>`
  const content = maskable
    ? `<g transform="translate(102.4 102.4) scale(0.8)">${FALLBACK_CONTENT}</g>`
    : FALLBACK_CONTENT
  return `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="${BRAND_COLOR}"/>
    </linearGradient>
  </defs>
  ${bgRect}
  ${content}
</svg>`
}

// Android通知トレイ用バッジ。仕様上モノクロ(白+透過)のシルエットが期待され、
// カラー画像を渡すと灰色に潰れるため専用に描く
const BADGE_SVG = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <path d="M512 128 L820 226 V520 C820 716 684 840 512 908 C340 840 204 716 204 520 V226 Z"
        fill="#ffffff"/>
</svg>`

async function toPng(input, size) {
  return sharp(input).resize(size, size).png()
}

async function generate() {
  await mkdir(PUBLIC_DIR, { recursive: true })

  const hasSource = existsSync(SOURCE_PNG)
  console.log(
    hasSource
      ? `source: ${SOURCE_PNG}`
      : "source: 暫定SVG(assets/pwa/icon-source.png が未配置のため)"
  )

  const anyBase = hasSource
    ? await sharp(SOURCE_PNG).resize(1024, 1024, { fit: "cover" }).png().toBuffer()
    : Buffer.from(fallbackSvg())

  // purpose "any": 全面アイコン
  for (const size of [192, 512]) {
    await (await toPng(anyBase, size)).toFile(resolve(PUBLIC_DIR, `icon-${size}.png`))
  }

  // purpose "maskable"
  if (hasSource) {
    // 正式アートは「主要素をセーフゾーン80%以内・背景単色」で生成する前提
    // (生成プロンプトに明記)のため、ブランド色パディングで拡張する
    for (const size of [192, 512]) {
      const inner = Math.round(size * 0.8)
      const offset = Math.round((size - inner) / 2)
      const content = await sharp(anyBase).resize(inner, inner).png().toBuffer()
      await sharp({
        create: { width: size, height: size, channels: 4, background: BRAND_COLOR },
      })
        .composite([{ input: content, left: offset, top: offset }])
        .png()
        .toFile(resolve(PUBLIC_DIR, `icon-maskable-${size}.png`))
    }
  } else {
    // 暫定SVGは maskable 専用版を直接描画(継ぎ目なし)
    const maskableBase = Buffer.from(fallbackSvg({ maskable: true }))
    for (const size of [192, 512]) {
      await (await toPng(maskableBase, size)).toFile(
        resolve(PUBLIC_DIR, `icon-maskable-${size}.png`)
      )
    }
  }

  // iOS ホーム画面用(iOSが角丸を付けるため不透明・全面)
  await sharp(anyBase)
    .resize(180, 180)
    .flatten({ background: BRAND_COLOR })
    .png()
    .toFile(resolve(PUBLIC_DIR, "apple-touch-icon.png"))

  // Android通知バッジ(常にモノクロシルエットから生成)
  await (await toPng(Buffer.from(BADGE_SVG), 96)).toFile(
    resolve(PUBLIC_DIR, "badge-96.png")
  )

  console.log(
    "generated: icon-192/512, icon-maskable-192/512, apple-touch-icon, badge-96 (public/)"
  )
}

generate().catch((err) => {
  console.error("icon generation failed:", err)
  process.exitCode = 1
})
