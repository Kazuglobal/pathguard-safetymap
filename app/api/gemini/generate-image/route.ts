import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGemini, getImageModel } from "@/lib/gemini-image"
import { createServerClient } from "@/lib/supabase-server"
import { logApiUsage } from "@/lib/api-usage-logger"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const modelName = getImageModel()
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
        { error: "Use multipart/form-data with fields: prompt (optional), image (optional)" },
        { status: 400 }
      )
    }

    const form = await req.formData()
    const prompt = (form.get("prompt") as string) || undefined
    const file = form.get("image") as File | null

    let imageBase64: string | undefined
    let imageMimeType: string | undefined

    if (file) {
      const buf = Buffer.from(await file.arrayBuffer())
      imageBase64 = buf.toString("base64")
      imageMimeType = file.type || "image/png"
    }

    const images = await generateImageWithGemini({
      prompt,
      imageBase64,
      imageMimeType,
    })

    try {
      logApiUsage({ api_provider: 'gemini', api_endpoint: 'generate-image', model_name: modelName, request_count: 1, estimated_cost_usd: 0.04, success: true })
    } catch { /* fire-and-forget */ }
    return NextResponse.json({ images })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    try {
      logApiUsage({ api_provider: 'gemini', api_endpoint: 'generate-image', model_name: modelName, request_count: 1, estimated_cost_usd: 0, success: false, error_message: message })
    } catch { /* fire-and-forget */ }
    // Graceful degrade: return empty result with warning so UI doesn't break
    return NextResponse.json({ images: [], warning: message }, { status: 200 })
  }
}
