import { NextRequest, NextResponse } from "next/server"
import { generateDisasterPrompts } from "@/lib/gemini-prompts"
import { createServerClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const FALLBACK_VIZ_PROMPT = `Photorealistic 2048x2048 infographic from the same viewpoint, camera height, and daylight as the uploaded Japanese suburban street photo. Maintain identical composition and lens characteristics. Overlay semi-transparent hazard shading with warning icons and Japanese labels: tilted fence (yellow shade + caution icons, label "フェンス注意"), leaning utility pole (yellow circle + arrow, label "電柱注意"), puddle on road (blue haze + droplet icons, label "冠水注意"), smoke in distance (light orange haze + warning icons, label "火災注意"). Use warning symbols and overlays only — do not show graphic destruction. High dynamic range, sharp focus, natural daylight, no extra people, vehicles, text, or watermarks, and do not mention model names.`

const FALLBACK_TABLE_MARKDOWN = [
  "| ハザード | 想定リスク (例) | その場でできる対策 (例) |",
  "|---|---|---|",
  "| 地震 | フェンス傾き / 落下物の可能性 / 路面のひび割れ | 注意範囲を回避 / 迂回誘導 / 点検を依頼 |",
  "| 台風(強風) | 飛散物 / フェンス変形 / 樹木の折損 | 緩んだ物を固定 / 安全側へ迂回案内 / 折れ枝を束ねて移動 |",
  "| 豪雨(洪水) | 道路冠水 / 排水詰まり / 滑りやすい路面 | 冠水エリアへの進入禁止サイン / 側溝のゴミ除去 / 足元注意喚起 |",
  "| 火災 | 延焼 / 煙による視界不良 / 火の粉落下 | 可燃物を遠ざける / 風上へ誘導 / 小火は消火器で初期消火 |",
].join("\n")

const FALLBACK_SIMULATION_PROMPTS = {
  earthquake:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo, showing mild earthquake aftermath: slightly tilted fence, a slightly leaning utility pole, some fallen leaves and small cracks on the pavement. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names.',
  typhoon:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo right after typhoon-class strong wind: bent or twisted fence, scattered branches and leaves, wet reflective pavement, displaced lightweight objects. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names.',
  flood:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo during a flash flood: approximately 20 cm of water covering the road and sidewalk, realistic reflections, ripples, floating leaves and trash. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names.',
  fire:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo with signs of a distant fire: light haze in the air, slight discoloration on nearby surfaces, faint smell of smoke suggested by thin haze layer. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names.',
}

function fallbackPrompts() {
  return {
    riskObservation: { elements: [], tableMarkdown: FALLBACK_TABLE_MARKDOWN },
    vizPrompt: FALLBACK_VIZ_PROMPT,
    simulationPrompts: { ...FALLBACK_SIMULATION_PROMPTS },
  }
}

export async function POST(req: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV !== "production"
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const contentType = req.headers.get("content-type") || ""
    let imageBase64: string | undefined
    let language: "ja" | "en" | undefined
    let customHazards: string[] | undefined

    if (contentType.includes("application/json")) {
      const body = await req.json()
      imageBase64 = body?.imageBase64 || body?.imageDataUrl
      language = body?.language
      customHazards = Array.isArray(body?.customHazards) ? body.customHazards : undefined
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image") as File | null
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        imageBase64 = buffer.toString("base64")
      } else {
        imageBase64 = (form.get("imageBase64") as string) || undefined
      }
      const langForm = (form.get("language") as string) || undefined
      if (langForm === "ja" || langForm === "en") {
        language = langForm
      }
      const hazardsRaw = form.get("customHazards") as string | null
      if (hazardsRaw) {
        customHazards = hazardsRaw.split(",").map((item) => item.trim()).filter(Boolean)
      }
    } else {
      return NextResponse.json({ error: "Use JSON or multipart/form-data" }, { status: 400 })
    }

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 })
    }

    try {
      const prompts = await generateDisasterPrompts(imageBase64, { language, customHazards })
      return NextResponse.json({ success: true, prompts })
    } catch (innerError) {
      const warning = innerError instanceof Error ? innerError.message : String(innerError)
      const safeWarning = isDev ? warning : "プロンプトの生成に失敗しました。"
      return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: safeWarning })
    }
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Unknown error"
    const safeWarning = process.env.NODE_ENV !== "production" ? warning : "内部エラーが発生しました。"
    return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: safeWarning })
  }
}
