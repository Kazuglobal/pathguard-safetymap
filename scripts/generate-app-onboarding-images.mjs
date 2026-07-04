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
    // その1: かぞくでつかう つうがくろの安全ノート(これは何のアプリ？)
    filename: "app-onboarding-1.png",
    prompt: `Scene: A parent and an elementary-school child sit together at a cozy table at
home, leaning over an open field notebook. On the notebook pages, a simple
hand-drawn town map shows a dotted route from a small house to a school building
with a red roof and a clock. The house and school are drawn as pure pictures
with ABSOLUTELY NO labels, letters, words or captions anywhere — not on the
notebook, not under the buildings. The mascot Lupe (magnifying glass with
yellow cap) hovers above the notebook, glowing softly, warmly welcoming them.
Mood: "this is our family's safety notebook", warm and inviting first page.
${STYLE_RULES}`,
  },
  {
    // その2: ちずを ひらくと「きをつけて」が みえる(地図の価値)
    filename: "app-onboarding-2.png",
    prompt: `Scene: A large, friendly bird's-eye hand-drawn town map fills most of the frame,
like a picture-book spread: small houses, a school with a red roof, a park, a
river, crosswalks. On the map stand several cute round map pins in orange,
yellow and green (no text on pins). The parent and child stand at the bottom
edge of the map looking at it together, the child pointing excitedly at an
orange pin. Lupe the magnifying-glass mascot hovers over one pin, magnifying it
with a soft glow.
Mood: "open the map, and the town's watch-out spots appear at a glance".
${STYLE_RULES}`,
  },
  {
    // その3: きになる ばしょは、しゃしんで パチリ(報告)
    filename: "app-onboarding-3.png",
    prompt: `Scene: On a small Japanese street corner, the child points at a spot near a
crosswalk while the parent takes a photo with a smartphone. From the phone, a
soft beam connects to a cute round map pin popping up above the spot, with tiny
sparkle stars. Lupe the magnifying-glass mascot watches proudly from the side.
Mood: "when we find something to be careful about, we tell the map".
${STYLE_RULES}`,
  },
  {
    // その4: まずは つうがくろを 1本 とうろく！(最初の行動)
    filename: "app-onboarding-4.png",
    prompt: `Scene: The parent and child kneel over a large hand-drawn town map spread on the
floor, together drawing a bold dotted route line with a big orange crayon from
their small house to the school with a red roof. The freshly drawn route glows
gently. Lupe the magnifying-glass mascot flies beside them cheerfully waving a
tiny yellow flag, celebrating. A few small green check-mark pins pop up along
the drawn route.
Mood: "let's register our school route — the adventure begins!", proud and fun.
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
  // 引数でスライド番号を指定すると、そのスライドだけ再生成できる。
  // 例: node scripts/generate-app-onboarding-images.mjs 1 3
  const onlyNumbers = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n >= 1)
  const targets = onlyNumbers.length > 0
    ? SLIDES.filter((_, i) => onlyNumbers.includes(i + 1))
    : SLIDES
  for (const slide of targets) {
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
