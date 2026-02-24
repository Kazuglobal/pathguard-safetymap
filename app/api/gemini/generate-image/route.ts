import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGeminiWithModel, getImageModel } from "@/lib/gemini-image"
import { createServerClient } from "@/lib/supabase-server"
import { logApiUsage } from "@/lib/api-usage-logger"
import { estimateImageGenerationCost } from "@/lib/api-cost-calculator"

export const runtime = "nodejs"
export const maxDuration = 60

const STANDARD_SCENARIO_IMAGE_MODEL = process.env.GEMINI_STANDARD_IMAGE_MODEL?.trim() || "gemini-2.5-pro-image-preview"
const DISASTER_PROMPT_IMAGE_MODEL = process.env.GEMINI_DISASTER_IMAGE_MODEL?.trim() || "gemini-3-pro-image-preview"

export async function POST(req: NextRequest) {
  let modelName = getImageModel()
  try {
    // 認証チェック - ログインユーザーのみ使用可能
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Use multipart/form-data with fields: prompt (optional), image (optional), generationMode (optional: standard|disaster)" },
        { status: 400 }
      )
    }

    const form = await req.formData()
    const prompt = (form.get("prompt") as string) || undefined
    const file = form.get("image") as File | null
    const generationMode = (form.get("generationMode") as string | null) || null

    let imageBase64: string | undefined
    let imageMimeType: string | undefined

    if (file) {
      const buf = Buffer.from(await file.arrayBuffer())
      imageBase64 = buf.toString("base64")
      imageMimeType = file.type || "image/png"
    }

    const requestedModel =
      generationMode === "disaster"
        ? DISASTER_PROMPT_IMAGE_MODEL
        : generationMode === "standard"
          ? STANDARD_SCENARIO_IMAGE_MODEL
          : undefined


    const result = await generateImageWithGeminiWithModel({
      prompt,
      imageBase64,
      imageMimeType,
      model: requestedModel,
    })
    modelName = result.model

    try {
      logApiUsage({
        api_provider: 'gemini',
        api_endpoint: 'generate-image',
        model_name: modelName,
        request_count: 1,
        estimated_cost_usd: estimateImageGenerationCost(modelName, 1),
        success: true,
      })
    } catch { /* fire-and-forget */ }
    return NextResponse.json({ images: result.images })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    try {
      logApiUsage({ api_provider: 'gemini', api_endpoint: 'generate-image', model_name: modelName, request_count: 1, estimated_cost_usd: 0, success: false, error_message: message })
    } catch { /* fire-and-forget */ }
    const statusCode = (() => {
      if (/unauthorized|forbidden|api.?key|401|403/i.test(message)) return 401
      if (/quota|rate.?limit|429/i.test(message)) return 429
      return 500
    })()
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
