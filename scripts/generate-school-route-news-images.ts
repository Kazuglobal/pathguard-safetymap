import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image"

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
  },
  {
    slug: "residential-road-30kmh",
    filename: "residential-road-30kmh.png",
    prompt: `Create a Japanese infographic illustration about a new speed limit law reducing residential road limits to 30km/h.

Visual elements:
- A narrow Japanese residential street (生活道路) with houses, fences, and power lines
- A large "30" speed limit road sign prominently displayed
- A car slowing down near a crosswalk
- Elementary school children walking safely with yellow caps and randoseru backpacks
- Traffic calming markings painted on the road surface
- A calendar/date indicator suggesting April 2026 law revision

Style: Clean Japanese educational infographic
Color palette: Orange/yellow for warning, blue for law/policy
Focus: New law awareness for local residents and families
${QUALITY_SUFFIX}`,
    description: "生活道路30km/h速度規制"
  },
  {
    slug: "spring-suspicious-alert",
    filename: "spring-suspicious-alert.png",
    prompt: `Create a Japanese safety awareness illustration about protecting children from suspicious strangers during spring.

Visual elements:
- A Japanese neighborhood street scene in spring (cherry blossoms)
- A child walking to school with yellow cap and randoseru
- A "いかのおすし" (safety rules for children) sign or poster nearby
- An adult volunteer in yellow safety vest watching over from a distance
- Bright, safe atmosphere but with subtle awareness messaging
- Community patrol or local neighborhood watch presence

Style: Warm but alert Japanese safety illustration
Color palette: Spring pinks and greens, yellow for safety
Mood: Protective, community-focused, child safety awareness
Focus: Spring seasonal alert without depicting threatening figures
${QUALITY_SUFFIX}`,
    description: "春の不審者警戒"
  },
  {
    slug: "zone30plus-model-districts",
    filename: "zone30plus-model-districts.png",
    prompt: `Create a Japanese illustration showing Zone 30 Plus model districts rollout across Japan.

Visual elements:
- A map of Japan with multiple highlighted regions (65 locations)
- A residential Japanese street with "ゾーン30プラス" zone signage
- Physical road safety measures: speed humps, colored pavement, bollards
- Elementary school children in yellow caps walking safely
- Police and local government representatives discussing plans
- An infographic-style layout showing before/after street improvements

Style: Modern Japanese infographic/editorial illustration
Color palette: Blue and green for infrastructure safety, orange for highlighted zones
Mood: Progressive, systematic, nationwide safety improvement
${QUALITY_SUFFIX}`,
    description: "ゾーン30プラス65箇所モデル地区"
  },
  {
    slug: "new-first-grader-safety",
    filename: "new-first-grader-safety.png",
    prompt: `Create a warm Japanese illustration showing a family walking a new school route with their first-grade child.

Visual elements:
- A cheerful new first-grader (新1年生) in a brand new uniform with yellow randoseru
- Parents walking the route together on a bright spring morning
- Cherry blossoms lining a Japanese residential street
- Crosswalks, traffic signals, and school zone markings
- A school building visible in the distance
- Community safety signs and friendly crossing guard in yellow vest

Style: Heartfelt, warm Japanese family illustration
Color palette: Spring pastels, yellow for school safety, warm family tones
Mood: Hopeful, safety-conscious, family bonding, new beginning
Focus: Importance of walking the school route before the start of school
${QUALITY_SUFFIX}`,
    description: "新1年生交通安全"
  },
  {
    slug: "national-spring-traffic-safety-campaign-20260330",
    filename: "national-spring-traffic-safety-campaign-20260330.png",
    prompt: `Create a Japanese illustration about the national spring traffic safety campaign (令和8年春の全国交通安全運動).

Visual elements:
- Elementary school children with yellow caps and randoseru crossing a crosswalk safely
- A volunteer in a yellow safety vest holding a yellow flag
- Spring cherry blossoms lining a Japanese residential street
- Traffic safety campaign banners (交通安全運動) on poles
- A school zone marking on the road
- Bright morning scene with warm sunlight

Style: Bright, community-oriented Japanese illustration
Color palette: Orange/yellow for safety campaign, spring pinks and greens
Mood: Safe, community support, awareness
Focus: Spring school commute safety and community watch
${QUALITY_SUFFIX}`,
    description: "令和8年春の全国交通安全運動"
  },
  {
    slug: "national-model-zone-65-areas-20260330",
    filename: "national-model-zone-65-areas-20260330.png",
    prompt: `Create a Japanese infographic illustration about the Ministry of Land Infrastructure Transport and Tourism selecting 65 model zones for school route safety improvements.

Visual elements:
- A stylized map of Japan with 65 highlighted points/regions
- A residential Japanese street with guardrails, widened sidewalks, and crosswalk markings
- Elementary school children walking safely with yellow caps and randoseru
- Road infrastructure elements: guardrails, colored pavement, pedestrian barriers
- An infographic-style layout suggesting nationwide coverage
- Government seal or document icon suggesting official policy

Style: Modern Japanese infographic/editorial illustration
Color palette: Blue and green for infrastructure safety, orange dots for highlighted zones
Mood: Progressive, systematic, nationwide safety improvement
Focus: Infrastructure-based safety improvements for school routes
${QUALITY_SUFFIX}`,
    description: "国交省モデル地域65箇所"
  },
  {
    slug: "national-school-watch-activity-handbook-20260330",
    filename: "national-school-watch-activity-handbook-20260330.png",
    prompt: `Create a warm Japanese illustration about community school route watch activities strengthened before the new school term.

Visual elements:
- Elderly and adult volunteers in bright yellow safety vests holding flags
- Elementary school children with yellow caps and randoseru walking safely
- A crosswalk scene in a Japanese neighborhood
- Spring cherry blossoms suggesting new school term
- A handbook or guidebook element suggesting the Ministry of Education handbook
- Community members smiling and cooperating

Style: Heartfelt, warm Japanese community illustration
Color palette: Greens and yellows for community warmth and safety
Mood: Cooperative, protective, hopeful community spirit
Focus: Volunteer watch activities protecting children on school routes
${QUALITY_SUFFIX}`,
    description: "新学期見守り活動強化"
  },
  {
    slug: "national-weekly-trend-20260706",
    filename: "national-weekly-trend-20260706.png",
    prompt: `Create a calm Japanese infographic-style illustration for a weekly school route safety trend report.

Visual elements:
- A clean weekly calendar page motif shown ONLY as seven blank squares with soft checkmark icons (no letters, no day names)
- A soft stylized map of Japan silhouette in the background
- A simple flat line chart motif staying at the bottom axis (calm, reassuring, zero incidents)
- Elementary school children with yellow caps and randoseru walking safely in summer morning light
- A parent checking a smartphone with a peaceful expression (blank glowing screen, no UI text)
- Early summer greenery (no cherry blossoms), hints of approaching summer break

STRICT RULE: Absolutely NO text of any kind anywhere in the image. No Japanese characters, no Latin letters, no numbers, no words on the calendar, chart, phone screen, or background. Purely pictorial.

Style: Modern Japanese editorial infographic, calm and analytical
Color palette: Soft purple and blue for analysis/report, warm green accents for reassurance
Mood: Peaceful, informative, trustworthy weekly review
Focus: Weekly data review and family preparedness, NOT danger or fear
${QUALITY_SUFFIX}`,
    description: "週次傾向レポート（2026年7月6日号）"
  },
  {
    slug: "sendai-aoba-kawadaira-repeated-suspicious-20260706",
    filename: "sendai-aoba-kawadaira-repeated-suspicious-20260706.png",
    prompt: `Create a Japanese safety awareness illustration about repeated voice-calling incidents targeting children on a school route in a residential neighborhood.

Scene elements (abstract, NOT depicting any actual person or incident):
- A quiet Japanese residential street in early summer, seen from a distance/wide angle
- Two elementary school girls with yellow safety caps and randoseru walking together, viewed from behind, small in the frame
- A faint, shadowy silhouette suggestion of an unseen presence at the edge of the frame (indistinct, not a depicted person)
- Warning/alert atmosphere without being frightening
- A "3 times in 3 weeks" repeated-pattern feeling conveyed through three faint overlapping street-corner motifs or a subtle repeating path marking

STRICT RULE: No text of any kind anywhere in the image.

Style: Somber but reassuring Japanese editorial illustration, NOT graphic or violent
Focus on the value of walking together (complementing the safety), not on depicting a threatening figure
Color palette: Muted orange/amber warning accents on a calm residential background
${QUALITY_SUFFIX}`,
    description: "仙台市青葉区川平 声かけ事案クラスタ（2026年7月6日号）"
  },
  {
    slug: "okayama-koto-guardrail-installed-20260627",
    filename: "okayama-koto-guardrail-installed-20260627.png",
    prompt: `Create a bright, reassuring Japanese illustration about a new guardrail installed beside an irrigation canal along a school route.

Visual elements:
- A newly installed metal guardrail running along a narrow canal/waterway beside a quiet residential road
- Elementary school children with yellow caps and randoseru walking safely on the protected side of the guardrail
- Green rice-paddy or canal-side scenery typical of Okayama, Japan
- Bright daylight, clear blue sky, a sense of relief and improved safety
- No text of any kind anywhere in the image

Style: Clean, bright Japanese editorial infographic illustration
Color palette: Blue/gray for the guardrail and infrastructure, green for the safe surroundings
Mood: Reassuring, community safety improvement, everyday life
${QUALITY_SUFFIX}`,
    description: "岡山市古都学区 通学路ガードレール設置（2026年7月6日号）"
  }
]

async function generateImage(config: NewsImageConfig): Promise<void> {
  const outputDir = path.join(process.cwd(), "public", "images", "school-route-news", "thumbnails")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, config.filename)

  // 公開済みサムネイルの意図しない再生成（上書き）を防ぐ。
  // 作り直したい場合は該当ファイルを削除してから実行する
  if (fs.existsSync(outputPath)) {
    console.log(`Skip (exists): ${config.filename}`)
    return
  }

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
