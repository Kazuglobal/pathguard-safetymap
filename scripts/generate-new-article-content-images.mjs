/**
 * 新記事（2026-03-15）の本文内画像生成スクリプト
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

const GEMINI_API_KEY = "AIzaSyCScOfZ8dbQWmfzDuKl5Y9ydVB5Zy-vPqg"
const GEMINI_MODEL = "gemini-3.1-flash-image-preview"

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

const CONTENT_IMAGES = [
  // --- bicycle-blue-ticket ---
  {
    articleSlug: "bicycle-blue-ticket",
    id: "violation-fines",
    description: "主な違反行為と反則金一覧",
    prompt: `Create a clean Japanese educational infographic showing bicycle traffic violation types and fines.

Layout: Vertical list of 5 violation cards

Each card shows:
1. 信号無視 (Signal violation) - 3,000円 - Red traffic light icon
2. ながらスマホ (Smartphone while riding) - 6,000円 - Smartphone with X mark icon
3. 一時不停止 (Failure to stop) - 3,000円 - Stop sign icon
4. 逆走 (Wrong-way riding) - 3,000円 - Arrow going wrong direction icon
5. 夜間無灯火 (No lights at night) - 3,000円 - Dark bicycle with no light icon

Design:
- Each card has a colored left border (red for highest fine, orange for others)
- Clean white cards with soft shadows
- Japanese icon style, cute but informative
- Fine amounts prominently displayed in bold
- Background: light gray gradient

Style: Professional Japanese infographic, educational, clear hierarchy
${QUALITY_SUFFIX}`
  },
  {
    articleSlug: "bicycle-blue-ticket",
    id: "age-target",
    description: "対象年齢（16歳以上）の説明図",
    prompt: `Create a Japanese educational illustration showing the age target for bicycle blue ticket system.

Visual concept:
- A horizontal age progression showing student types
- Left side: 14-15 year old middle school students (対象外 - NOT targeted) - shown in gray/muted
- Right side: 16+ year old high school and university students (対象 - TARGETED) - shown in color
- A clear dividing line at age 16 with "16歳" label
- Students wearing appropriate Japanese school uniforms:
  - Junior high: dark uniform (中学生)
  - High school: blazer or sailor uniform (高校生)
  - University: casual (大学生)
- Blue ticket icon appearing above the 16+ group

Color coding:
- Under 16: gray, faded appearance
- 16 and over: full color, with blue ticket symbol

Style: Clean Japanese infographic, friendly but educational
${QUALITY_SUFFIX}`
  },

  // --- 30kmh-speed-limit ---
  {
    articleSlug: "30kmh-speed-limit",
    id: "fatality-rate",
    description: "衝突速度別の歩行者致死率比較",
    prompt: `Create a Japanese educational infographic comparing pedestrian fatality rates at different vehicle speeds.

Visual design: Three comparative columns

LEFT - 30km/h:
- Green color scheme
- Small car icon driving slowly
- Pedestrian figure with shield (protected)
- Large "約10%" text
- Label: 致死率（歩行者）

CENTER - 50km/h:
- Orange color scheme
- Medium car icon
- Pedestrian figure with warning symbol
- Large "約75%" text
- Label: 致死率（歩行者）

RIGHT - 60km/h (current default):
- Red color scheme
- Car icon with speed lines
- Pedestrian figure with danger symbol
- Large "約95%以上" text
- Label: 致死率（歩行者）

Bottom highlight:
- Arrow pointing to 30km/h column
- Text: "2026年9月から生活道路の法定速度"
- Green badge

Style: Clean Japanese medical/safety infographic style, clear visual hierarchy
${QUALITY_SUFFIX}`
  },
  {
    articleSlug: "30kmh-speed-limit",
    id: "zone30-comparison",
    description: "ゾーン30と今回の法改正の違い",
    prompt: `Create a Japanese comparison infographic between "Zone 30" (ゾーン30) and the 2026 speed limit law change.

Split layout - two columns:

LEFT COLUMN - ゾーン30（従来）:
- Purple/blue header
- City map icon with designated zone highlighted
- Icons showing: application process, limited area coverage
- Label: 各自治体が申請・整備
- Label: 申請した区域のみ
- Label: ハンプ・狭窄など物理的整備あり
- Coverage indicator: partial Japan map

RIGHT COLUMN - 2026年9月 法改正:
- Green header with star/new badge
- Japan map with nationwide coverage highlighted
- Icons showing: automatic application, nationwide
- Label: 法律で全国一律に適用
- Label: 全国の無標識生活道路
- Label: 速度規制のみ（物理的整備なし）
- Coverage indicator: full Japan map

Center divider: VS symbol

Bottom note: "標識がなければ自動的に30km/h"

Style: Professional Japanese legal/policy infographic, clear comparison design
${QUALITY_SUFFIX}`
  },

  // --- ai-camera-kakogawa ---
  {
    articleSlug: "ai-camera-kakogawa",
    id: "crime-reduction",
    description: "刑法犯認知件数の推移（6年で4割減）",
    prompt: `Create a Japanese infographic showing crime reduction statistics for Kakogawa city due to AI cameras.

Visual design: Bar chart or area graph

Data points:
- 2017: ~3,000件 (baseline, before AI cameras)
- 2018: slight decrease (AI cameras installed)
- 2019-2022: steady decline
- 2023: ~1,752件 (約40%減)

Chart elements:
- Downward trend arrow in green
- "約40%減" in large bold green text
- Camera icon at 2018 start point showing when system was introduced
- Simple bar chart with year labels
- Japanese city silhouette background (Kakogawa style)

Highlight boxes:
- "2017年: 約3,000件" in red/orange
- "2023年: 1,752件" in green
- "▼ 約40%削減" badge

Style: Clean Japanese data visualization, celebratory but informative
${QUALITY_SUFFIX}`
  },
  {
    articleSlug: "ai-camera-kakogawa",
    id: "ai-features",
    description: "AIカメラの3つの機能説明図",
    prompt: `Create a Japanese educational illustration showing 3 key AI camera features in a clean layout.

Three feature panels arranged vertically or in a 3-column grid:

FEATURE 1 - 異常音検知 (Abnormal Sound Detection):
- AI camera icon with sound wave visualization
- Sound waves emanating from a scene
- Alert notification symbol
- Color: Blue/cyan theme
- Label: 悲鳴・異常音を自動検知

FEATURE 2 - 危険接近検知 (Dangerous Approach Detection):
- Car approaching pedestrian with warning lines
- Distance measurement indicator
- Speaker and rotating light activating
- Color: Orange/amber theme
- Label: 車両の危険接近を警告

FEATURE 3 - リアルタイム通知 (Real-time Notification):
- Camera connected to monitoring center
- Smartphone/computer receiving alert
- Clock showing rapid response
- Color: Green theme
- Label: 担当部署へ即時通知

Style: Tech-forward Japanese UI/infographic style, clean icons, professional
${QUALITY_SUFFIX}`
  },

  // --- suspicious-person-statistics ---
  {
    articleSlug: "suspicious-person-statistics",
    id: "time-chart",
    description: "声かけ事案の発生時間帯グラフ",
    prompt: `Create a Japanese infographic showing the time distribution of suspicious approach incidents involving children.

Visual design: Clock or bar chart showing time distribution

Key data:
- 15:00-16:00: 26.7% (MOST COMMON - highlighted)
- 16:00-17:00: ~20%
- 14:00-15:00: ~15%
- Other times: smaller percentages

Design elements:
- Large analog clock face or timeline as main visual
- The 3PM-4PM sector highlighted in warning orange/red
- Other sectors in lighter colors
- "下校時間帯" label over the 14:00-17:00 range
- Japanese elementary school children icon at peak time
- Warning badge: "最多 26.7%"
- Source citation: 千葉県警察データ

Background: Soft gradient from day to evening colors

Style: Clean Japanese data infographic, educational and clear
${QUALITY_SUFFIX}`
  },
  {
    articleSlug: "suspicious-person-statistics",
    id: "location-chart",
    description: "発生場所の内訳（路上65.5%）",
    prompt: `Create a Japanese infographic showing where suspicious approach incidents occur (location breakdown).

Visual design: Donut/pie chart with location icons

Data:
- 路上 (Road/Street): 65.5% - DOMINANT - shown in warning orange
- 公園・広場 (Parks): ~10-15% - shown in green
- 駐車場・駐輪場 (Parking lots): ~5% - shown in gray
- 店舗内 (Inside stores): ~5% - shown in blue
- その他 (Other): remaining - shown in light gray

Design elements:
- Large donut chart as main visual
- Each segment labeled with Japanese text and percentage
- Icon for each location type:
  - Road: street/sidewalk icon
  - Park: tree icon
  - Parking: P sign icon
  - Store: shopping bag icon
- Center of donut: warning shield icon
- Prominent callout: "路上での発生が 65.5%"

Right side: Simple map showing typical route between school and home
- Route marked in orange (highest risk)
- School and home icons

Style: Clean Japanese statistical infographic, clear visual hierarchy
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
    if (!imagePart) { console.error("No image data in response"); return false }

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
  console.log("=== 新記事 本文内画像生成 (2026-03-15) ===\n")
  const baseDir = path.join(ROOT, "public", "images", "safe-magazine", "articles")

  for (const img of CONTENT_IMAGES) {
    const outputPath = path.join(baseDir, img.articleSlug, `${img.id}.png`)
    console.log(`\n[${img.articleSlug}] ${img.description}`)
    await generateImage(img.prompt, outputPath)
    await new Promise(r => setTimeout(r, 3000))
  }

  console.log("\n=== 完了 ===")
}

main().catch(console.error)
