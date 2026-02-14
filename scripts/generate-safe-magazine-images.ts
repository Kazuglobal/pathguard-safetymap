/**
 * PathGuard Press 記事用画像生成スクリプト
 * Gemini 3 Pro Image Preview を使用
 * 高品質な教育用イラストを生成
 */

import fs from "fs"
import path from "path"
import dotenv from "dotenv"

// Load .env.local
dotenv.config({ path: ".env.local" })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview"

console.log("API Key loaded:", GEMINI_API_KEY ? "Yes" : "No")
console.log("API Key prefix:", GEMINI_API_KEY?.substring(0, 10) + "...")
console.log("Model:", GEMINI_MODEL)

interface ImageConfig {
  articleId: string
  articleSlug: string
  category: string
  title: string
  thumbnailPrompt: string
  contentImages: Array<{
    id: string
    prompt: string
    description: string
  }>
}

// 日本向け高品質プロンプトテンプレート
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

// 記事ごとの画像設定（高品質プロンプト）
const ARTICLE_IMAGES: ImageConfig[] = [
  {
    articleId: "2026-02-06-chikushino-accident",
    articleSlug: "chikushino-accident",
    category: "accident-news",
    title: "対策済み通学路でも事故発生",
    thumbnailPrompt: `Create an illustration depicting a Japanese elementary school commute scene with safety concerns.

Scene elements (Japanese specific):
- Japanese residential neighborhood (住宅街) with traditional tile-roofed houses
- Elementary school children wearing yellow safety caps (黄色い帽子) and carrying red/black randoseru backpacks (ランドセル)
- A marked crosswalk (横断歩道) on a narrow Japanese street
- Green safety fence/guardrail (ガードレール) along the sidewalk
- A "School Zone" warning sign (スクールゾーン標識) - yellow diamond shape
- Green belt road marking (グリーンベルト) on pavement edge
- A parked car suggesting the danger of blind spots

Mood: Slightly concerning atmosphere showing potential danger despite safety measures
Style: Japanese manga/anime inspired illustration with soft shading, suitable for educational content
Color palette: Warm earth tones, yellow safety accents, soft morning light
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "hard-vs-soft",
        prompt: `Create a Japanese-style educational infographic comparing safety measures for school routes.

LEFT SIDE - ハード対策 (Physical Infrastructure):
- Guardrail/safety fence icon (ガードレール)
- Traffic signal with pedestrian light (信号機)
- Green belt pavement marking (グリーンベルト)
- Speed bump illustration
- Zone 30 speed limit sign
Background: Cool blue gradient

RIGHT SIDE - ソフト対策 (Human-based Solutions):
- Elderly volunteer with yellow flag (見守りボランティア)
- Crossing guard lady in green uniform (緑のおばさん)
- Parent walking with child carrying randoseru
- Community watch symbol (地域の目)
- Safety education illustration
Background: Warm green gradient

Style: Clean Japanese infographic design, friendly icons, educational aesthetic
Divided layout with clear comparison
${QUALITY_SUFFIX}`,
        description: "ハード対策とソフト対策の比較図"
      }
    ]
  },
  {
    articleId: "2026-02-06-school-route-safety-statistics",
    articleSlug: "school-route-safety-statistics",
    category: "danger-ranking",
    title: "小1の事故リスクは6年生の2.9倍",
    thumbnailPrompt: `Create an illustration showing Japanese first-grade elementary school student safety awareness.

Scene elements:
- A small Japanese first-grade student (小学1年生) wearing:
  - Yellow safety cap (黄色い帽子)
  - Red or black randoseru backpack (ランドセル)
  - Standing at a crosswalk looking uncertain
- Larger figure of a 6th grader (6年生) shown for size comparison
- Japanese street crossing scene with zebra crossing
- Visual indicator showing "2.9x risk" concept (small child = more vulnerable)
- Warm, protective mood with slight concern undertone

Style: Soft Japanese illustration style, anime-inspired but educational
Focus: Size difference between grades, vulnerability of young children
Color palette: Warm yellows, soft oranges for caution, protective green accents
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "grade-comparison",
        prompt: `Create a Japanese educational illustration showing elementary school students by grade with risk indicators.

Visual layout:
- 6 Japanese elementary school children standing in a row
- Each child represents grades 1-6 (1年生〜6年生)
- Size progression from small (1st grade) to tall (6th grade)
- All wearing yellow safety caps and randoseru backpacks
- Color-coded risk indicators above each child:
  - 1st grade: Large red/orange warning circle
  - Gradually decreasing to small green circle for 6th grade
- Japanese labels: 1年生, 2年生, 3年生, 4年生, 5年生, 6年生

Style: Cute Japanese educational illustration, friendly and approachable
Background: Soft gradient, school-themed
Mood: Educational, highlighting age-related vulnerability
${QUALITY_SUFFIX}`,
        description: "学年別事故リスク比較チャート"
      },
      {
        id: "progress-circle",
        prompt: `Create a Japanese-style infographic showing 91% safety progress achievement.

Main elements:
- Large circular progress indicator (donut chart style)
- 91% segment in bright green (達成 - achieved)
- 9% segment in light gray (残り - remaining)
- Center area with a shield or checkmark symbol
- Small Japanese elementary school themed icons around (randoseru, yellow cap)
- Clean, professional Japanese infographic design

Visual style:
- Bold, clear progress ring
- Soft shadows for depth
- Celebratory but professional mood
- Suitable for Japanese government/education reports

Color palette: Green for success, gray for remaining, white background
${QUALITY_SUFFIX}`,
        description: "通学路安全対策91%完了の進捗表示"
      }
    ]
  },
  {
    articleId: "2026-02-06-nagara-mimamori-guide",
    articleSlug: "nagara-mimamori-guide",
    category: "volunteer-activity",
    title: "ながら見守りのすすめ",
    thumbnailPrompt: `Create a warm Japanese community scene showing "ながら見守り" (while-doing watching) activities.

Scene elements:
- Japanese residential neighborhood (日本の住宅街) with traditional houses
- Morning golden hour lighting
- Elementary school children walking to school with yellow caps and randoseru

Community members doing daily activities while watching children:
- Elderly Japanese woman (おばあちゃん) watering garden plants
- Man walking a Shiba Inu dog
- Person sweeping the front of their house
- Neighbor greeting children with a wave

Japanese specific elements:
- Narrow residential street typical of Japan
- Small gardens with potted plants
- Yellow school zone signs
- Warm, safe community atmosphere

Style: Warm Japanese slice-of-life illustration, soft watercolor-like aesthetic
Color palette: Warm earth tones, soft greens, morning sunlight gold
Mood: Community warmth, gentle protection, everyday kindness
${QUALITY_SUFFIX}`,
    contentImages: [
      {
        id: "nagara-examples",
        prompt: `Create a Japanese illustration showing 4 examples of "ながら見守り" activities in a 2x2 grid.

Grid layout with 4 scenes:

TOP LEFT - 犬の散歩 (Dog Walking):
- Japanese person walking a Shiba Inu
- Morning neighborhood scene
- Soft green background

TOP RIGHT - 買い物帰り (Shopping):
- Person with エコバッグ shopping bags
- Passing by school children
- Warm orange background

BOTTOM LEFT - 庭の水やり (Gardening):
- Elderly person watering plants in garden
- Watching children walk by
- Pink/coral background

BOTTOM RIGHT - ジョギング (Jogging):
- Person jogging in the neighborhood
- Wearing reflective gear
- Light blue background

Each scene shows interaction with school children (yellow caps, randoseru)
Style: Cute Japanese illustration, warm and friendly
Consistent design language across all 4 panels
${QUALITY_SUFFIX}`,
        description: "ながら見守りの4つの例"
      },
      {
        id: "hachimitsu-jiman",
        prompt: `Create a Japanese children's safety education illustration for "はちみつじまん" mnemonic.

Visual layout - 7 icons with Japanese hiragana characters:

は - 話しかけてくる (Approaches to talk):
- Suspicious adult figure with speech bubble
- Child looking uncertain

ち - 近づいてくる (Comes too close):
- Figure stepping into personal space
- Warning indicator

み - 見つめてくる (Stares at you):
- Eyes watching symbol
- Uncomfortable feeling

つ - ついてくる (Follows you):
- Footsteps following
- Shadow behind child

じ - 車に乗せようとする (Tries to get in car):
- Car with open door
- Warning symbol

ま - 待っている (Waiting/lurking):
- Figure hiding behind object
- Suspicious behavior

ん - 逃げる！(Run away):
- Child running to safety
- Safe destination (こども110番の家)

Style: Bright, child-friendly Japanese educational illustration
Clear icons with Japanese text labels
Suitable for elementary school safety education
Color palette: Bright colors, red for danger, green for safety
${QUALITY_SUFFIX}`,
        description: "防犯合言葉「はちみつじまん」"
      }
    ]
  }
]

async function generateImage(prompt: string, outputPath: string): Promise<boolean> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set")
    return false
  }

  try {
    console.log(`Generating image: ${path.basename(outputPath)}`)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["image", "text"],
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`API Error: ${errorData.error?.message || response.statusText}`)
      return false
    }

    const data = await response.json()
    const candidates = data.candidates

    if (!candidates || candidates.length === 0) {
      console.error("No response from API")
      return false
    }

    const parts = candidates[0].content?.parts
    if (!parts) {
      console.error("No content parts in response")
      return false
    }

    // Find image data in response
    const imagePart = parts.find((part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData)
    if (!imagePart || !imagePart.inlineData) {
      console.error("No image data in response")
      console.log("Response parts:", JSON.stringify(parts, null, 2))
      return false
    }

    // Save image to file
    const imageData = imagePart.inlineData.data
    const buffer = Buffer.from(imageData, "base64")

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, buffer)
    console.log(`✓ Saved: ${outputPath}`)
    return true
  } catch (error) {
    console.error(`Error generating image:`, error)
    return false
  }
}

async function generateAllImages() {
  console.log("=== PathGuard Press 日本向け高品質画像生成 ===\n")

  const basePath = path.join(process.cwd(), "public", "images", "safe-magazine")

  for (const config of ARTICLE_IMAGES) {
    console.log(`\n--- Article: ${config.title} ---`)

    // Generate thumbnail
    const thumbnailPath = path.join(basePath, "thumbnails", `${config.articleSlug}.png`)
    await generateImage(config.thumbnailPrompt, thumbnailPath)

    // Wait between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Generate content images
    for (const contentImage of config.contentImages) {
      const imagePath = path.join(basePath, "articles", config.articleSlug, `${contentImage.id}.png`)
      await generateImage(contentImage.prompt, imagePath)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  console.log("\n=== Generation Complete ===")
}

// Run the script
generateAllImages().catch(console.error)
