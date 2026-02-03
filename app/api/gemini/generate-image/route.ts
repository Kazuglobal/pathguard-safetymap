import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGemini } from "@/lib/gemini-image"
import { createServerClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ images })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    // Graceful degrade: return empty result with warning so UI doesn't break
    return NextResponse.json({ images: [], warning: message }, { status: 200 })
  }
}
