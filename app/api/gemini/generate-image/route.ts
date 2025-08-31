import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGemini } from "@/lib/gemini-image"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

