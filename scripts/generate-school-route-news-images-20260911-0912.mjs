/**
 * 通学路の安全ニュース 2026-09-11 / 2026-09-12 更新分のサムネイル生成
 * 使い方: node scripts/generate-school-route-news-images-20260911-0912.mjs [--only=slug1,slug2]
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
    filename: "fukuoka-late-august-child-approach-cluster-20260828.png",
    description: "福岡県 車の3人組による声かけ（不審者）",
    prompt: `Create a Japanese safety awareness illustration about children staying alert to strangers calling out from a car.

Scene elements (abstract, NOT depicting the suspects or any confrontation):
- A quiet Japanese residential street in late afternoon
- A parked car in the middle distance with dark, fully shaded windows so no one inside is visible
- Two elementary school children with yellow caps and randoseru backpacks walking away together, seen from behind, keeping to the far side of the street
- A small orange "kodomo 110-ban" style safe-house sign shape on a house wall (no readable text)

Style: Calm, watchful, safety awareness focused
Color palette: Warm neutrals with orange caution accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "national-living-road-casualty-analysis-20260910.png",
    description: "全国 生活道路の死傷者分析（警察庁の集計）",
    prompt: `Create a Japanese safety awareness illustration about narrow residential "living roads" shared by children and elderly people.

Scene elements (abstract, NOT depicting an accident):
- A narrow Japanese residential road without sidewalks, bordered by houses and low walls
- Painted green roadside strip along the edge (no road markings with characters or numbers)
- An elderly person with a cane and an elementary school child with a yellow cap walking along the edge, both seen from behind
- A car slowly approaching in the distance
- A subtle, clean bar-chart motif integrated into the sky or margin, without any numbers or letters

Style: Informative, calm, policy explainer
Color palette: Soft blue and white with reassuring tones
${QUALITY_SUFFIX}`
  },
  {
    filename: "sagamihara-watch-volunteer-exchange-20260824.png",
    description: "神奈川県相模原市 見守りボランティアの情報交換会",
    prompt: `Create a Japanese community illustration about school-route watch volunteers sharing information with each other.

Scene elements:
- A bright community center meeting room with a long table
- Several adult volunteers wearing yellow safety vests and armbands, seen from behind or in side silhouette with no detailed faces
- A large paper map of school routes spread on the table with colored pins and sticky notes (no readable text)
- Thermos cups and flags for crossing guards resting nearby

Style: Warm, cooperative, hopeful
Color palette: Warm green and cream tones
${QUALITY_SUFFIX}`
  },
  {
    filename: "ichinomiya-fuji-bicycle-collision-20260910.png",
    description: "愛知県一宮市 信号のない交差点での自転車事故",
    prompt: `Create a Japanese safety awareness illustration about stopping and checking at an unsignalized intersection while riding a bicycle.

Scene elements (abstract, NOT depicting a collision or injury):
- A Japanese residential intersection with no traffic signals, surrounded by walls that block the view
- A convex traffic mirror on a pole at the corner
- A child on a small bicycle wearing a helmet, stopped with one foot on the ground before the intersection, seen from behind
- A white stop line painted on the road in front of the bicycle
- The front of a car only hinted at by its shadow around the blind corner

Style: Serious but calm, safety awareness focused
Color palette: Muted tones with red warning accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "kumamoto-kita-shimizukamei-stalking-20260909.png",
    description: "熊本県熊本市北区 下校中のつきまとい（不審者）",
    prompt: `Create a Japanese safety awareness illustration about walking home from school with friends instead of alone.

Scene elements (abstract, NOT depicting any follower or suspicious person):
- A suburban Japanese road in the afternoon with rice fields and houses
- Three elementary school girls with yellow caps and randoseru backpacks walking home together, seen from behind
- One child holding a personal safety alarm attached to her backpack strap
- A crossing guard's flag stand and a bright convenience store in the distance as a safe place

Style: Reassuring, protective, safety awareness focused
Color palette: Warm neutrals with orange caution accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "hiroshima-city-september-voice-calls-20260903.png",
    description: "広島県広島市 2学期最初の週の声かけ（不審者）",
    prompt: `Create a Japanese safety awareness illustration about the start of the second school term and staying alert near parks.

Scene elements (abstract, NOT depicting any stranger or suspect):
- A neighborhood park entrance in early September with green trees and cicada-season light
- Playground equipment in the background
- Two elementary school children with yellow caps and randoseru backpacks walking past the park together on the sidewalk, seen from behind
- An empty bench and a brightly lit house with an adult neighbor watering plants, seen from behind, as a place to ask for help
- No shop signs, banners, or any signage with characters

Style: Calm, watchful, safety awareness focused
Color palette: Late-summer greens with orange caution accents
${QUALITY_SUFFIX}`
  },
  {
    filename: "gifu-kano-schoolguard-watch-20260828.png",
    description: "岐阜県岐阜市 夏休み明け初日の見守り活動",
    prompt: `Create a Japanese community illustration about volunteers watching over children on the first school day after summer vacation.

Scene elements:
- A Japanese residential street in the morning with a crosswalk
- Adult volunteers in yellow safety vests holding yellow crossing flags at the roadside, seen from behind or in side silhouette with no detailed faces
- A line of elementary school children with yellow caps and randoseru backpacks walking to school, seen from behind
- A roadside banner shape reminding drivers to slow down (no readable text)
- Bright morning sunlight

Style: Warm, community spirit, hopeful
Color palette: Warm green and golden morning tones
${QUALITY_SUFFIX}`
  },
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
  console.log("=== 通学路の安全ニュース サムネイル生成 (2026-09-11 / 2026-09-12) ===")
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="))
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null
  const targets = only ? IMAGES.filter((config) => only.some((slug) => config.filename.startsWith(slug))) : IMAGES

  const failures = []
  for (const config of targets) {
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
