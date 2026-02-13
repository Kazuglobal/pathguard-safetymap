import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview"

console.log(`API Key loaded: ${API_KEY ? "Yes" : "No"}`)
console.log(`Model: ${MODEL}`)

const QUALITY_SUFFIX = `
Technical specifications:
- High resolution, sharp details
- Japanese editorial illustration style
- Clean, professional design
- No watermarks, no text overlays, no signatures
- Warm, appropriate for family and education content
- Anime/manga inspired art style for Japanese audiences
`

interface NewsImageConfig {
  slug: string
  filename: string
  prompt: string
  description: string
}

const NEWS_IMAGES: NewsImageConfig[] = [
  {
    slug: "fukuoka-asakura-accident",
    filename: "fukuoka-asakura-accident.png",
    prompt: `Create a Japanese safety awareness illustration about a traffic accident at an intersection involving children on bicycles.

Scene elements (abstract, NOT depicting actual accident):
- A quiet Japanese rural intersection without traffic signals
- A bicycle lying on its side near the intersection
- Yellow safety cap on the ground
- Tire marks on the road surface
- Warning/caution atmosphere
- Japanese road markings and surroundings

Style: Somber but not graphic, Japanese editorial illustration
Focus on safety awareness, NOT on depicting injury
Color palette: Muted tones with red warning accents
${QUALITY_SUFFIX}`,
    description: "福岡県朝倉市の交差点事故"
  },
  {
    slug: "bicycle-blue-ticket",
    filename: "bicycle-blue-ticket.png",
    prompt: `Create a Japanese infographic-style illustration about new bicycle traffic rules starting April 2026.

Visual elements:
- A bicycle on a Japanese road with clear lane markings
- A blue ticket/citation document icon
- Japanese traffic signs for bicycle lanes
- Split view showing correct vs incorrect bicycle road usage
- Elementary school children safely on the sidewalk
- Adults on bicycles using the road properly

Style: Clean Japanese educational infographic
Color palette: Blue for rules/policy, green for safety
Focus: New rules awareness for families
${QUALITY_SUFFIX}`,
    description: "自転車青切符制度"
  },
  {
    slug: "zone30plus-model",
    filename: "zone30plus-model.png",
    prompt: `Create a Japanese illustration showing a "Zone 30 Plus" school safety zone.

Visual elements:
- A Japanese residential street with "30" speed limit painted on road
- Physical speed reduction devices (humps, narrowing)
- Safety bollards and colored pavement markings
- Elementary school children walking safely with yellow caps and randoseru
- A school building in the background
- Zone 30 Plus signage

Style: Bright, positive Japanese editorial illustration
Color palette: Blue for infrastructure, green for safety
Mood: Safe, modern, well-planned community
${QUALITY_SUFFIX}`,
    description: "ゾーン30プラス"
  },
  {
    slug: "mext-nationwide-alert",
    filename: "mext-nationwide-alert.png",
    prompt: `Create a professional Japanese government announcement illustration about school route safety.

Scene elements:
- Japanese government/ministry setting (official, formal)
- Map of Japan in background showing multiple prefectures highlighted: 大阪府 (Osaka), 埼玉県 (Saitama), 福岡県 (Fukuoka)
- Warning/alert symbol (注意喚起 - attention/caution)
- Silhouettes of elementary school children with yellow safety caps and randoseru
- Document or bulletin board showing "文部科学省" (Ministry of Education)
- Calendar showing January 2026 (1月)
- Serious but constructive mood

Visual style:
- Professional Japanese government infographic aesthetic
- Clean, authoritative design
- Red/orange alert colors combined with official blue
- Icons representing: education boards (教育委員会), school guards (スクールガード), budget allocation (予算)

Japanese text elements to include visually:
- "全国注意喚起" (Nationwide Alert)
- "異例の事態" (Unusual Situation)
- Calendar dates: 1/1, 1/14, 1/19 marked

Mood: Official, serious, protective, government authority
Color palette: Official blue, alert red/orange, white background
${QUALITY_SUFFIX}`,
    description: "文科省全国注意喚起"
  },
  {
    slug: "iga-safety-signs",
    filename: "iga-safety-signs.png",
    prompt: `Create a warm Japanese community scene showing a safety sign donation ceremony for school routes.

Scene elements (Japanese specific):
- Japanese rural/suburban setting in Mie Prefecture (三重県)
- "飛び出し注意" (Watch Out for Children) safety sign - classic Japanese yellow diamond-shaped sign with child figure
- Construction company representative (竹島建設 worker) presenting/installing sign
- Local community members and district officers (地区役員) observing
- County road (県道) setting with narrow Japanese street
- Elementary school children walking with yellow safety caps and randoseru in background
- Ayama Elementary/Junior High School (阿山小学校・中学校) visible in distance

Mood: Community cooperation, warmth, local pride, safety-focused
Atmosphere: Bright daylight, hopeful, collaborative

Visual style:
- Warm Japanese slice-of-life illustration
- Soft, friendly aesthetic suitable for community news
- Focus on human connection and local collaboration
- Construction company worker in uniform/vest with company logo visible

Japanese text elements to include visually:
- "飛び出し注意" on the sign
- Community gathering feeling

Color palette:
- Yellow for safety sign (classic Japanese warning sign color)
- Warm earth tones for community setting
- Green accents (company activity, nature)
- Bright, optimistic colors

Setting details:
- Residential area typical of Japanese countryside cities
- Small traditional shops or houses in background
- Power lines, narrow roads typical of Japanese prefectural roads
${QUALITY_SUFFIX}`,
    description: "伊賀市看板寄贈"
  },
  {
    slug: "mext-volunteer-awards",
    filename: "mext-volunteer-awards.png",
    prompt: `Create a warm Japanese illustration showing school safety volunteer activities.

Visual elements:
- Elderly Japanese volunteers wearing yellow safety vests
- Holding yellow safety flags at a crosswalk
- Elementary school children with yellow caps and randoseru crossing safely
- A warm morning scene in a Japanese neighborhood
- Cherry blossoms or seasonal greenery
- Community members watching over children with smiles
- A "スクールガード" (School Guard) armband

Style: Warm, heartfelt Japanese illustration
Color palette: Warm yellows, greens, community warmth
Mood: Gratitude, community support, safety
${QUALITY_SUFFIX}`,
    description: "見守りボランティア表彰"
  }
]

async function generateImage(config: NewsImageConfig): Promise<void> {
  const outputDir = path.join(process.cwd(), "public", "images", "school-route-news", "thumbnails")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, config.filename)

  console.log(`Generating: ${config.filename}`)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

  const body = {
    contents: [
      {
        parts: [
          {
            text: config.prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const candidates = data.candidates
  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates in response")
  }

  const parts = candidates[0].content?.parts
  if (!parts) {
    throw new Error("No parts in response")
  }

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, "base64")
      fs.writeFileSync(outputPath, buffer)
      console.log(`  Saved: ${outputPath}`)
      return
    }
  }

  throw new Error("No image data in response")
}

async function generateAllImages() {
  console.log("=== 通学路の安全ニュース 画像生成 ===\n")

  for (const config of NEWS_IMAGES) {
    try {
      await generateImage(config)
    } catch (error) {
      console.error(`  Error generating ${config.filename}:`, error)
    }
  }

  console.log("\n=== 完了 ===")
}

generateAllImages()
