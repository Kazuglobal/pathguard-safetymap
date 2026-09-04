/**
 * 通学路の安全ニュース 2026-09-04 更新分のサムネイル生成
 * 使い方: node scripts/generate-school-route-news-images-20260904.mjs
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

dotenv.config({ path: path.join(ROOT, ".env.local") })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview"

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set. Add it to .env.local before running this script.")
}

const OUTPUT_DIR = path.join(ROOT, "public", "images", "school-route-news", "thumbnails")

const QUALITY_SUFFIX = `
Technical specifications:
- High resolution, sharp details, 16:9 landscape composition
- Japanese editorial illustration style, stylized anime/manga inspired
- Clean lines, balanced composition with clear visual hierarchy
- No watermarks, no text overlays, no signatures, no letters or numbers
- Never depict injury, blood, a crash impact, or an identifiable person's face
- Warm, appropriate for family and education content
`

const IMAGES = [
  {
    filename: "kawanishi-tadain-schoolgate-hitandrun-20260827.png",
    description: "兵庫県川西市 校門付近のひき逃げ（交通事故）",
    prompt: `Create a Japanese safety awareness illustration about the danger zone right outside an elementary school's main gate.

Scene elements (abstract, NOT depicting an accident or injury):
- A Japanese elementary school main gate seen from the street side, gate pillars and school building behind
- A car exiting the gate area, viewed from behind, with its blind-spot area suggested by soft shading
- A yellow school cap and randoseru backpack of a child walking near the gate, seen from behind at a distance
- Road markings and a caution cone near the gate
- Late morning light

Style: Somber but calm, safety awareness focused
Color palette: Muted tones with red warning accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "sapporo-nishi-hassamu-crosswalk-20260827.png",
    description: "北海道札幌市 信号のある横断歩道の事故",
    prompt: `Create a Japanese safety awareness illustration about a child crossing alone at a signalized crosswalk.

Scene elements (abstract, NOT depicting an accident or injury):
- A wide Japanese city intersection with a pedestrian traffic signal showing green
- White zebra crossing stripes across the road
- One small child with a yellow cap standing alone at the near edge of the crosswalk, seen from behind
- A car approaching from the left side of the frame, slowing, headlights on
- Northern Japanese city streetscape, wide sky

Style: Calm, instructional, emphasis on "look left before stepping out"
Color palette: Cool blues and grays with a red warning accent
${QUALITY_SUFFIX}`
  },
  {
    filename: "sendai-izumi-koyodai-stalking-20260903.png",
    description: "宮城県仙台市泉区 下校中のつきまとい",
    prompt: `Create a Japanese crime-prevention awareness illustration about being followed on the way home from school.

Scene elements (abstract, do NOT depict a recognizable suspect's face):
- A quiet Japanese residential street in a hillside housing district, afternoon light
- Two students walking together seen from behind, school bags on their shoulders
- A vague, shadowed adult silhouette further back on the same street, unfocused and faceless
- A convenience store or a "こども110番の家" style safe-house sign visible ahead as a place to escape to
- Long afternoon shadows on the pavement

Style: Tense but not frightening; the safe destination should read as hopeful
Color palette: Warm afternoon tones with orange alert accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "matsuyama-hirata-store-touch-20260901.png",
    description: "愛媛県松山市 商業施設での声かけ・接触事案",
    prompt: `Create a Japanese crime-prevention awareness illustration about staying safe inside a shopping centre.

Scene elements (abstract, do NOT depict a recognizable suspect's face or any physical contact):
- The bright interior of a Japanese shopping centre, shops and a kids' play corner in the background
- Two young children standing together, seen from behind
- A blurred, faceless adult silhouette at a distance among shoppers
- A clearly visible service counter / staff member area highlighted as the place to go for help
- Clean, bright indoor lighting

Style: Reassuring and instructional, emphasis on "go to a staff member"
Color palette: Bright interior neutrals with orange alert accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "national-autumn-traffic-safety-campaign-20260921.png",
    description: "全国 秋の全国交通安全運動（施策）",
    prompt: `Create a Japanese public-information style illustration about the autumn national traffic safety campaign.

Scene elements:
- A Japanese residential street at dusk, sun low, sky in warm amber and deep blue
- Elementary school children walking home with yellow caps and randoseru, reflective tape on bags and shoes glowing
- A car with its headlights switched on early, slowing near a crosswalk
- A local volunteer in a reflective vest holding a safety flag at the crossing
- A child with a bicycle helmet standing at the roadside

Style: Positive, community-minded public awareness poster illustration
Color palette: Dusk ambers and blues with purple policy accents and bright reflective highlights
${QUALITY_SUFFIX}`
  }
]

async function generateImage(config) {
  const outputPath = path.join(OUTPUT_DIR, config.filename)
  console.log(`\nGenerating: ${config.description}`)
  console.log(`  -> ${config.filename}`)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  const body = {
    contents: [{ parts: [{ text: config.prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts) throw new Error("No parts in response")

  for (const part of parts) {
    if (part.inlineData) {
      fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, "base64"))
      console.log(`  Saved: ${outputPath}`)
      return
    }
  }

  throw new Error("No image data in response")
}

async function main() {
  console.log("=== 通学路の安全ニュース サムネイル生成 (2026-09-04) ===")
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const failures = []
  for (const config of IMAGES) {
    try {
      await generateImage(config)
    } catch (error) {
      console.error(`  Error generating ${config.filename}:`, error.message)
      failures.push(config.filename)
    }
  }

  console.log("\n=== 完了 ===")
  if (failures.length > 0) {
    console.error(`失敗: ${failures.join(", ")}`)
    process.exitCode = 1
  }
}

main()
