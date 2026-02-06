/**
 * Gemini 2.5 Flash 画像生成ユーティリティ
 * SAFE MAGAZINE用のサムネイルと記事内画像を生成
 *
 * Model: gemini-3-pro-image-preview
 * ネイティブ画像生成機能を使用
 */

import fs from "fs"
import path from "path"

// 環境変数から取得
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview"

export interface ImageGenerationConfig {
  aspectRatio: "16:9" | "1:1" | "4:3" | "3:4" | "9:16"
  numberOfImages: number
  safetyFilterLevel: "BLOCK_LOW_AND_ABOVE" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_HIGH_AND_ABOVE"
  personGeneration: "ALLOW" | "DONT_ALLOW"
}

export interface GeneratedImage {
  id: string
  path: string
  prompt: string
  dimensions: string
  caption?: string
}

export interface ImageGenerationResult {
  articleId: string
  generatedAt: string
  thumbnail?: GeneratedImage
  articleImages: GeneratedImage[]
  metadata: {
    model: string
    safetyFilter: string
    error?: string
  }
}

// デフォルト設定
const DEFAULT_CONFIG: ImageGenerationConfig = {
  aspectRatio: "16:9",
  numberOfImages: 1,
  safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
  personGeneration: "DONT_ALLOW"
}

// カテゴリー別のプロンプトテンプレート
export const PROMPT_TEMPLATES = {
  "accident-news": {
    style: "Japanese school zone safety awareness illustration",
    elements: "crosswalk, traffic signs, warning symbols",
    mood: "serious but educational, not frightening",
    colors: "red accent for warning, soft background colors"
  },
  "danger-ranking": {
    style: "Data visualization infographic illustration",
    elements: "charts, graphs, statistics symbols, safety icons",
    mood: "informative, clear, professional",
    colors: "orange and yellow for caution, blue for data"
  },
  "volunteer-activity": {
    style: "Warm community illustration",
    elements: "neighborhood street, safety patrol signs, greenery",
    mood: "friendly, supportive, welcoming",
    colors: "green for safety, warm earth tones"
  },
  "safety-tips": {
    style: "Educational illustration for children",
    elements: "traffic rules icons, safety symbols, simple diagrams",
    mood: "bright, easy to understand, encouraging",
    colors: "primary colors, high contrast for visibility"
  },
  "policy-update": {
    style: "Official policy announcement illustration",
    elements: "government buildings, documents, institutional symbols",
    mood: "trustworthy, authoritative, informative",
    colors: "blue for trust, white for clarity"
  }
} as const

export type CategoryType = keyof typeof PROMPT_TEMPLATES

/**
 * 画像生成プロンプトを構築
 */
export function buildImagePrompt(
  category: CategoryType,
  articleTitle: string,
  customElements?: string
): string {
  const template = PROMPT_TEMPLATES[category]

  const basePrompt = `
${template.style},
${template.elements}${customElements ? `, ${customElements}` : ""},
${template.mood},
${template.colors},
Japanese school route context,
clean modern vector illustration style,
no identifiable faces or people (silhouettes only if needed),
high quality, suitable for educational content
  `.trim().replace(/\n/g, " ")

  return basePrompt
}

/**
 * Gemini APIで画像を生成
 */
export async function generateImage(
  prompt: string,
  outputPath: string,
  config: Partial<ImageGenerationConfig> = {}
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not set in environment variables"
    }
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  try {
    // Gemini API呼び出し（ネイティブ画像生成）
    console.log(`Using model: ${GEMINI_MODEL}`)
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
                  text: `Generate an image with the following specifications:
${prompt}

Style: Clean, modern illustration suitable for educational content about school safety.
Aspect ratio: ${finalConfig.aspectRatio}
Important: Do not include any identifiable faces or realistic people.`
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["image", "text"],
            responseMimeType: "image/png"
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: `API Error: ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Gemini 2.5 Flash のレスポンス形式から画像を取得
    const candidates = data.candidates
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: "No response from API"
      }
    }

    const parts = candidates[0].content?.parts
    if (!parts) {
      return {
        success: false,
        error: "No content parts in response"
      }
    }

    // inlineDataを持つパートを探す
    const imagePart = parts.find((part: { inlineData?: { data: string } }) => part.inlineData)
    if (!imagePart || !imagePart.inlineData) {
      return {
        success: false,
        error: "No image data in response"
      }
    }

    // 画像をファイルに保存
    const imageData = imagePart.inlineData.data
    const buffer = Buffer.from(imageData, "base64")

    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, buffer)

    return {
      success: true,
      path: outputPath
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * 記事用の画像セットを生成
 */
export async function generateArticleImages(
  articleId: string,
  category: CategoryType,
  articleTitle: string,
  imageRequirements: {
    thumbnail: boolean
    contentImages?: Array<{ id: string; description: string }>
  }
): Promise<ImageGenerationResult> {
  const result: ImageGenerationResult = {
    articleId,
    generatedAt: new Date().toISOString(),
    articleImages: [],
    metadata: {
      model: "gemini-3-pro-image-preview",
      safetyFilter: "default"
    }
  }

  const basePath = `public/images/safe-magazine`

  // サムネイル生成
  if (imageRequirements.thumbnail) {
    const thumbnailPrompt = buildImagePrompt(category, articleTitle)
    const thumbnailPath = `${basePath}/thumbnails/${articleId}.png`

    const thumbnailResult = await generateImage(thumbnailPrompt, thumbnailPath, {
      aspectRatio: "16:9"
    })

    if (thumbnailResult.success && thumbnailResult.path) {
      result.thumbnail = {
        id: "thumbnail",
        path: thumbnailResult.path,
        prompt: thumbnailPrompt,
        dimensions: "1200x630"
      }
    } else {
      result.metadata.error = thumbnailResult.error
    }
  }

  // 記事内画像生成
  if (imageRequirements.contentImages) {
    for (const imageReq of imageRequirements.contentImages) {
      const contentPrompt = buildImagePrompt(category, articleTitle, imageReq.description)
      const imagePath = `${basePath}/articles/${articleId}/${imageReq.id}.png`

      const imageResult = await generateImage(contentPrompt, imagePath, {
        aspectRatio: "4:3"
      })

      if (imageResult.success && imageResult.path) {
        result.articleImages.push({
          id: imageReq.id,
          path: imageResult.path,
          prompt: contentPrompt,
          dimensions: "800x600",
          caption: imageReq.description
        })
      }
    }
  }

  return result
}

/**
 * プレースホルダー画像を生成（API未設定時のフォールバック）
 */
export function generatePlaceholderSVG(
  category: CategoryType,
  width: number = 1200,
  height: number = 630
): string {
  const colors = {
    "accident-news": { bg: "#FEE2E2", fg: "#EF4444", icon: "⚠️" },
    "danger-ranking": { bg: "#FED7AA", fg: "#F97316", icon: "📊" },
    "volunteer-activity": { bg: "#DCFCE7", fg: "#22C55E", icon: "👥" },
    "safety-tips": { bg: "#DBEAFE", fg: "#3B82F6", icon: "🛡️" },
    "policy-update": { bg: "#E9D5FF", fg: "#8B5CF6", icon: "📋" }
  }

  const { bg, fg, icon } = colors[category]

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="50%" y="45%" text-anchor="middle" font-size="80" fill="${fg}">${icon}</text>
  <text x="50%" y="60%" text-anchor="middle" font-size="24" fill="${fg}" font-family="sans-serif">
    SAFE MAGAZINE
  </text>
</svg>
  `.trim()
}
