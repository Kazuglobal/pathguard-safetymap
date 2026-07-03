// PathGuardian アプリ全体オンボーディング(絵本モード)用イラスト生成。
// 既存のきけんハンター絵本 (public/images/hunter/onboarding-1.png) を
// スタイルリファレンスとして渡し、世界観・マスコット「ルペ」を統一する。
// Usage: node scripts/generate-app-onboarding-images.mjs
import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image"

if (!API_KEY) {
  console.error("GEMINI_API_KEY is not set")
  process.exit(1)
}

const STYLE_REF = path.join(process.cwd(), "public", "images", "hunter", "onboarding-1.png")
const OUT_DIR = path.join(process.cwd(), "public", "images", "onboarding")

const STYLE_RULES = `
Match the attached reference illustration EXACTLY in style:
- Warm Japanese picture-book illustration on cream paper background (#FBF5E9 tone)
- Thick, soft dark-brown outlines (not black), flat colors, gentle rounded shapes
- Palette: forest green, safety orange, sun yellow, cream, soft blue-green accents
- The mascot "Lupe": a friendly magnifying glass character — round cream lens face
  with simple dot eyes and smiling mouth, wearing a small yellow safety cap,
  wooden handle at lower right, exactly like in the reference image
- Characters: a Japanese parent and an elementary-school child (yellow safety cap,
  randoseru backpack) with simple dot eyes and blush cheeks, same as reference
- Dotted-line路 (adventure trail) motifs are welcome
- NO text, NO letters, NO watermark anywhere in the image
- Aspect ratio 4:3, generous margins, subject centered
`

const SLIDES = [
  {
    filename: "app-onboarding-1.png",
    prompt: `Scene: A parent and child sit together at a cozy table at home, leaning over a
large hand-drawn adventure map of their town spread out like a field notebook.
The map shows a dotted route from a small house to a school, with a few cute
round pins (green, orange, yellow) along the way. The mascot Lupe (magnifying
glass with yellow cap) hovers over the map, glowing softly, pointing at the route.
Mood: curious, warm, "our town is a little adventure".
${STYLE_RULES}`,
  },
  {
    filename: "app-onboarding-2.png",
    prompt: `Scene: On a small Japanese street corner, the child points at a spot near a
crosswalk while the parent takes a photo with a smartphone. From the phone, a
soft beam connects to a cute round map pin popping up above the spot, with tiny
sparkle stars. Lupe the magnifying-glass mascot watches proudly from the side.
Mood: "when we find something to be careful about, we tell the map".
${STYLE_RULES}`,
  },
  {
    filename: "app-onboarding-3.png",
    prompt: `Scene: Evening at home. Parent and child sit on a sofa looking together at a
tablet showing a simple card with a photo and a small map. Speech bubbles WITHOUT
any text (just a heart and a small exclamation mark icon) float above them as
they talk. Lupe the magnifying-glass mascot sits on the sofa armrest, listening.
Warm lamp light, cozy living room.
Mood: family strategy meeting, talking together about safety.
${STYLE_RULES}`,
  },
  {
    filename: "app-onboarding-4.png",
    prompt: `Scene: Bright morning. The child, wearing yellow cap and randoseru, walks
happily along a street toward a school in the distance. The route ahead is shown
as a glowing dotted line with small green check-mark pins along it. The parent
waves from the house gate. Lupe the magnifying-glass mascot flies alongside the
child like a guardian. Small birds and a clear sky.
Mood: "off we go, safe and confident!".
${STYLE_RULES}`,
  },
]

async function generateImage(slide, refBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "image/png", data: refBase64 } },
          { text: slide.prompt },
        ],
      },
    ],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText.slice(0, 400)}`)
  }
  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts) throw new Error("No parts in response")
  for (const part of parts) {
    if (part.inlineData) {
      fs.writeFileSync(path.join(OUT_DIR, slide.filename), Buffer.from(part.inlineData.data, "base64"))
      console.log(`saved: ${slide.filename}`)
      return
    }
  }
  throw new Error("No image data in response")
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const refBase64 = fs.readFileSync(STYLE_REF).toString("base64")
  for (const slide of SLIDES) {
    let ok = false
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        await generateImage(slide, refBase64)
        ok = true
      } catch (e) {
        console.error(`attempt ${attempt} failed for ${slide.filename}:`, e.message)
        await new Promise((r) => setTimeout(r, 3000 * attempt))
      }
    }
    if (!ok) process.exitCode = 1
  }
  console.log("done")
}

main()
