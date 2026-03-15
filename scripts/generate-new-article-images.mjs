/**
 * 新記事（2026-03-15）のサムネイル画像生成スクリプト
 * Node.js ESM で直接実行可能
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

dotenv.config({ path: path.join(ROOT, ".env.local") })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = "gemini-3.1-flash-image-preview"

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set. Add it to .env.local before running this script.")
}

const QUALITY_SUFFIX = `
Technical specifications:
- High resolution, sharp details
- Professional Japanese editorial illustration quality
- Clean lines and smooth gradients
- Balanced composition with visual hierarchy
- Suitable for web and print media
- No watermarks, no text overlays, no signatures
- Use stylized anime/manga inspired art style suitable for Japanese audiences
- Warm, friendly aesthetic appropriate for family and education content
`

const NEW_ARTICLES = [
  {
    slug: "bicycle-blue-ticket",
    title: "自転車青切符制度",
    prompt: `Create a Japanese educational illustration about bicycle traffic rules for middle and high school students.

Scene elements:
- Japanese middle/high school student (16+ years old) riding a bicycle on a school commute route
- Wearing school uniform, school bag on back
- A police officer issuing a traffic violation ticket (青切符) - blue colored slip
- Japanese street scene with bicycle lane markings
- Warning signs visible: no smartphone while riding, stop signs, signal lights
- Other students watching and learning from the scene

Key visual elements:
- A blue ticket/slip (青切符) prominently displayed
- Bicycle with proper safety equipment (light, reflector)
- Japanese road markings and signs

Style: Clear Japanese editorial illustration, slightly serious but educational tone
Color palette: Blue accents (for 青切符), school uniform colors, Japanese street elements
Mood: Informational, slightly cautionary
${QUALITY_SUFFIX}`
  },
  {
    slug: "30kmh-speed-limit",
    title: "生活道路30km/h制限",
    prompt: `Create a Japanese illustration showing a residential street with a new 30km/h speed limit sign.

Scene elements:
- Narrow Japanese residential street (生活道路) in a suburban neighborhood
- A prominent new speed limit sign showing "30" in a red circle
- Japanese elementary school children (yellow caps, randoseru) walking safely on the sidewalk
- Cars driving slowly past, respecting the new speed limit
- Traditional Japanese houses lining both sides of the street
- Green belt markings on the road edge

Visual contrast element:
- Show the "30" speed limit sign as the focal point
- Children feeling safe on the pavement
- Peaceful residential atmosphere

Style: Warm Japanese neighborhood illustration, slice-of-life aesthetic
Color palette: Warm residential tones, red speed limit sign, yellow safety accents
Mood: Safe, protective, community-oriented
${QUALITY_SUFFIX}`
  },
  {
    slug: "ai-camera-kakogawa",
    title: "加古川市高度化見守りカメラ",
    prompt: `Create a Japanese illustration showing Kakogawa city's school-route safety camera program.

Scene elements:
- A neighborhood map or streetscape suggesting roughly 1,500 watch-over camera locations across the city
- One highlighted advanced safety camera mounted on a pole in a Japanese neighborhood
- The advanced camera has a glowing blue/cyan indicator light suggesting smart detection features
- Japanese elementary school children (yellow safety caps, randoseru) walking safely below
- Semi-transparent digital overlay showing AI detection:
  - Sound wave indicator (for audio detection)
  - Car proximity alert visual
- Japanese residential street in a suburban neighborhood
- Community safety atmosphere

Technology visualization:
- Futuristic but approachable advanced camera design
- Small label suggesting "150台の高度化見守りカメラ"
- Warning speaker/rotating light system on the pole

Style: Japanese technology + safety illustration, clean tech aesthetic meets warm community feel
Color palette: Tech blue/cyan for AI elements, warm tones for neighborhood, yellow for children
Mood: Protected, technologically advanced, community safety
${QUALITY_SUFFIX}`
  },
  {
    slug: "suspicious-person-statistics",
    title: "声かけ事案の時間帯統計と対策",
    prompt: `Create a Japanese safety awareness illustration about suspicious-approach prevention during school commute hours.

Scene elements:
- Japanese elementary school children walking home in the afternoon around 3pm (warm light)
- Children walking in a group (group safety concept)
- A "子ども110番の家" (Child 110 emergency house) visible with its yellow triangle sign
- Defense action visual: children aware of surroundings, bright prevention buzzer (防犯ブザー) on a randoseru strap
- A clock showing 15時台 as the peak hour

Key safety message visual elements:
- Group walking = safer
- 子ども110番の家 as a refuge
- After-school warning time setting

Style: Clear Japanese safety education illustration, serious but not frightening
Color palette: Afternoon warm orange light, warning yellows, safe greens
Mood: Alert but empowering, children as active participants in their own safety
${QUALITY_SUFFIX}`
  }
]

async function generateImage(prompt, outputPath) {
  try {
    console.log(`Generating: ${path.basename(outputPath)}`)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["image", "text"] }
        })
      }
    )

    if (!response.ok) {
      const err = await response.json()
      console.error(`API Error: ${err.error?.message || response.statusText}`)
      return false
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts
    if (!parts) { console.error("No content parts"); return false }

    const imagePart = parts.find(p => p.inlineData)
    if (!imagePart) { console.error("No image data"); return false }

    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, "base64"))
    console.log(`✓ Saved: ${outputPath}`)
    return true
  } catch (err) {
    console.error(`Error:`, err.message)
    return false
  }
}

async function main() {
  console.log("=== 新記事サムネイル画像生成 (2026-03-15) ===\n")
  const thumbnailDir = path.join(ROOT, "public", "images", "safe-magazine", "thumbnails")

  for (const article of NEW_ARTICLES) {
    console.log(`\n--- ${article.title} ---`)
    const outputPath = path.join(thumbnailDir, `${article.slug}.png`)
    await generateImage(article.prompt, outputPath)
    await new Promise(r => setTimeout(r, 3000))
  }

  console.log("\n=== 完了 ===")
}

main().catch(console.error)
