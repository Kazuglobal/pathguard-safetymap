/**
 * SAFE MAGAZINE プレースホルダー画像生成スクリプト
 * SVG形式で仮画像を作成
 */

import fs from "fs"
import path from "path"

interface ImageConfig {
  articleSlug: string
  category: string
  title: string
  thumbnailIcon: string
  contentImages: Array<{
    id: string
    icon: string
    description: string
  }>
}

const CATEGORY_COLORS = {
  "accident-news": { bg: "#FEE2E2", fg: "#DC2626", accent: "#EF4444" },
  "danger-ranking": { bg: "#FED7AA", fg: "#C2410C", accent: "#F97316" },
  "volunteer-activity": { bg: "#DCFCE7", fg: "#15803D", accent: "#22C55E" },
} as const

const ARTICLE_CONFIGS: ImageConfig[] = [
  {
    articleSlug: "chikushino-accident",
    category: "accident-news",
    title: "対策済み通学路でも事故発生",
    thumbnailIcon: "⚠️",
    contentImages: [
      { id: "hard-vs-soft", icon: "⚖️", description: "ハード対策 vs ソフト対策" }
    ]
  },
  {
    articleSlug: "school-route-safety-statistics",
    category: "danger-ranking",
    title: "小1リスク2.9倍",
    thumbnailIcon: "📊",
    contentImages: [
      { id: "grade-comparison", icon: "📈", description: "学年別リスク比較" },
      { id: "progress-circle", icon: "✅", description: "91%完了" }
    ]
  },
  {
    articleSlug: "nagara-mimamori-guide",
    category: "volunteer-activity",
    title: "ながら見守り",
    thumbnailIcon: "👥",
    contentImages: [
      { id: "nagara-examples", icon: "🚶", description: "見守りの例" },
      { id: "hachimitsu-jiman", icon: "🛡️", description: "はちみつじまん" }
    ]
  }
]

function generateThumbnailSVG(config: ImageConfig): string {
  const colors = CATEGORY_COLORS[config.category as keyof typeof CATEGORY_COLORS]

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-${config.articleSlug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:white;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg-${config.articleSlug})"/>

  <!-- Decorative circles -->
  <circle cx="100" cy="100" r="200" fill="${colors.accent}" opacity="0.1"/>
  <circle cx="1100" cy="530" r="150" fill="${colors.accent}" opacity="0.1"/>

  <!-- Central icon -->
  <text x="600" y="280" text-anchor="middle" font-size="120" filter="url(#shadow)">${config.thumbnailIcon}</text>

  <!-- Title card -->
  <rect x="100" y="400" width="1000" height="180" rx="20" fill="white" filter="url(#shadow)" opacity="0.95"/>

  <!-- Category badge -->
  <rect x="130" y="430" width="140" height="36" rx="18" fill="${colors.accent}"/>
  <text x="200" y="455" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="white">SAFE MAGAZINE</text>

  <!-- Title text -->
  <text x="130" y="520" font-family="sans-serif" font-size="36" font-weight="bold" fill="#1F2937">${config.title}</text>

  <!-- Footer line -->
  <rect x="130" y="550" width="60" height="4" rx="2" fill="${colors.accent}"/>
</svg>`
}

function generateContentSVG(
  config: ImageConfig,
  content: { id: string; icon: string; description: string }
): string {
  const colors = CATEGORY_COLORS[config.category as keyof typeof CATEGORY_COLORS]

  return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="content-bg-${content.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:white;stop-opacity:1" />
    </linearGradient>
    <filter id="content-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#content-bg-${content.id})"/>

  <!-- Decorative elements -->
  <circle cx="700" cy="100" r="80" fill="${colors.accent}" opacity="0.1"/>
  <circle cx="100" cy="500" r="60" fill="${colors.accent}" opacity="0.1"/>

  <!-- Central icon -->
  <text x="400" y="280" text-anchor="middle" font-size="100" filter="url(#content-shadow)">${content.icon}</text>

  <!-- Description card -->
  <rect x="150" y="380" width="500" height="100" rx="16" fill="white" filter="url(#content-shadow)" opacity="0.95"/>

  <!-- Description text -->
  <text x="400" y="440" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="#374151">${content.description}</text>

  <!-- Accent line -->
  <rect x="350" y="460" width="100" height="4" rx="2" fill="${colors.accent}"/>
</svg>`
}

async function generateAllPlaceholders() {
  console.log("=== Generating Placeholder Images ===\n")

  const basePath = path.join(process.cwd(), "public", "images", "safe-magazine")

  for (const config of ARTICLE_CONFIGS) {
    console.log(`--- ${config.title} ---`)

    // Generate thumbnail
    const thumbnailDir = path.join(basePath, "thumbnails")
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true })
    }

    const thumbnailPath = path.join(thumbnailDir, `${config.articleSlug}.svg`)
    const thumbnailSVG = generateThumbnailSVG(config)
    fs.writeFileSync(thumbnailPath, thumbnailSVG)
    console.log(`✓ Thumbnail: ${thumbnailPath}`)

    // Generate content images
    const articleDir = path.join(basePath, "articles", config.articleSlug)
    if (!fs.existsSync(articleDir)) {
      fs.mkdirSync(articleDir, { recursive: true })
    }

    for (const content of config.contentImages) {
      const contentPath = path.join(articleDir, `${content.id}.svg`)
      const contentSVG = generateContentSVG(config, content)
      fs.writeFileSync(contentPath, contentSVG)
      console.log(`✓ Content: ${contentPath}`)
    }
  }

  console.log("\n=== Generation Complete ===")
  console.log(`\nTo use AI-generated images, set a valid GEMINI_API_KEY and run:`)
  console.log(`npx tsx scripts/generate-safe-magazine-images.ts`)
}

generateAllPlaceholders()
