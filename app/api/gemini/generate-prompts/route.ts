import { NextRequest, NextResponse } from "next/server"
import { generateDisasterPrompts } from "@/lib/gemini-prompts"
import { createServerClient } from "@/lib/supabase-server"
import { logApiUsage } from "@/lib/api-usage-logger"

export const runtime = "nodejs"

const FALLBACK_VIZ_PROMPT = `Photorealistic 2048x2048 infographic from the same viewpoint, camera height, and daylight as the uploaded Japanese suburban street photo. Maintain identical composition and lens characteristics. Overlay semi-transparent hazard shading with caution icons and Japanese labels: potential wall/fence risk area (yellow shade + caution icons, label "塀・壁 注意"), utility pole vicinity (yellow circle + arrow, label "電柱周辺 注意"), potential flooding area (blue haze + droplet icons, label "冠水注意"), fire spread risk direction (light orange haze + warning icons, label "延焼注意"). Use warning overlays only — do not depict actual destruction or damage. High dynamic range, sharp focus, natural daylight, no extra people, vehicles, text, or watermarks, and do not mention model names.`

const FALLBACK_TABLE_MARKDOWN = [
  "| ハザード | 想定リスク (例) | その場でできる対策 (例) |",
  "|---|---|---|",
  "| 地震 | 塀のひび割れ・傾き / 落下物の可能性 / 路面の小さなひび | 塀から離れる / 迂回誘導 / 点検を依頼 |",
  "| 台風(強風) | 飛散物（植木鉢・看板）/ フェンス変形 / 枝の折損 | 緩んだ物を固定 / 安全側へ迂回案内 / 折れ枝を束ねて移動 |",
  "| 豪雨(冠水) | 道路冠水（15〜20cm）/ 排水詰まり / 滑りやすい路面 | 冠水エリアへの進入禁止 / 側溝のゴミ除去 / 足元注意喚起 |",
  "| 火災 | 煙による視界低下 / 近隣延焼リスク / 煤の付着 | 可燃物を遠ざける / 風上へ避難 / 小火は消火器で初期消火 |",
].join("\n")

const FALLBACK_SIMULATION_PROMPTS = {
  earthquake:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo, showing a moderate earthquake aftermath (seismic intensity 5-upper): block walls and fences show hairline cracks and minor mortar dust at joints; a utility pole may lean very slightly; small loose items (flower pots, signs) displaced on the ground; minor pavement cracks. Structures remain mostly standing — the scene is shaken but NOT devastated. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names. Do NOT show explosion-like destruction or large dust clouds.',
  typhoon:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo right after strong wind (approximately 30m/s): scattered tree branches and leaves on wet pavement; lightweight objects (garbage bins, small signs) displaced; fences may rattle or bend slightly but remain standing; wet reflective road surface with puddles. Solid structures are intact. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names. Do NOT show uprooted trees or destroyed buildings.',
  flood:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo during urban flooding: approximately 15-20 cm of muddy brownish water covering the road and lower portions of sidewalk, realistic water reflections and small ripples, floating leaves and minor debris, visible water line on curbs and wall bases. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names.',
  fire:
    'Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo with signs of a nearby fire (fire source is NOT visible in frame): thin smoke haze reducing visibility slightly in the background, very light soot deposits on nearest surfaces, a faint warm-orange tint in the hazy sky. No active flames, no burning vehicles, no charred ruins visible. High dynamic range, sharp focus, no people, no additional vehicles, no watermarks, and do not mention model names.',
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
      logApiUsage({ api_provider: 'gemini', api_endpoint: 'generate-prompts', model_name: 'gemini-2.5-flash', request_count: 1, estimated_cost_usd: 0.002, success: true })
      return NextResponse.json({ success: true, prompts })
    } catch (innerError) {
      const warning = innerError instanceof Error ? innerError.message : String(innerError)
      logApiUsage({ api_provider: 'gemini', api_endpoint: 'generate-prompts', model_name: 'gemini-2.5-flash', request_count: 1, estimated_cost_usd: 0, success: false, error_message: warning })
      const safeWarning = isDev ? warning : "プロンプトの生成に失敗しました。"
      return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: safeWarning })
    }
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Unknown error"
    const safeWarning = process.env.NODE_ENV !== "production" ? warning : "内部エラーが発生しました。"
    return NextResponse.json({ success: false, prompts: fallbackPrompts(), warning: safeWarning })
  }
}
