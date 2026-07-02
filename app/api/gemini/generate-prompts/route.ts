import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generateDisasterPrompts } from "@/lib/gemini-prompts"
import {
  FALLBACK_SIMULATION_PROMPTS,
  FALLBACK_TABLE_MARKDOWN,
  FALLBACK_VIZ_PROMPT,
} from "@/lib/disaster-image-prompt-fallbacks"
import { createServerClient } from "@/lib/supabase-server"
import { logApiUsage } from "@/lib/api-usage-logger"
import { readFileWithSentryContext } from "@/lib/sentry-upload-context"

const CUSTOM_HAZARD_SCHEMA = z.string().trim().min(1).max(100)
  .regex(/^[\w\s\-\u3040-\u9FFF\u30A0-\u30FF\uFF00-\uFFEF]+$/u)

const MAX_CUSTOM_HAZARDS = 8

function validateCustomHazards(raw: string[]): { valid: string[] } | { error: string } {
  if (raw.length > MAX_CUSTOM_HAZARDS) {
    return { error: `customHazards は最大 ${MAX_CUSTOM_HAZARDS} 件までです` }
  }
  const valid: string[] = []
  for (const item of raw) {
    const result = CUSTOM_HAZARD_SCHEMA.safeParse(item)
    if (!result.success) {
      return { error: `無効な customHazard 値: "${item.slice(0, 30)}"` }
    }
    valid.push(result.data)
  }
  return { valid }
}

export const runtime = "nodejs"

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
      if (Array.isArray(body?.customHazards)) {
        const validation = validateCustomHazards(body.customHazards)
        if ("error" in validation) {
          return NextResponse.json({ error: validation.error }, { status: 400 })
        }
        customHazards = validation.valid
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image") as File | null
      if (file) {
        const buffer = Buffer.from(
          await readFileWithSentryContext({
            route: "/api/gemini/generate-prompts",
            fieldName: "image",
            file,
          }),
        )
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
        const rawList = hazardsRaw.split(",").map((item) => item.trim()).filter(Boolean)
        const validation = validateCustomHazards(rawList)
        if ("error" in validation) {
          return NextResponse.json({ error: validation.error }, { status: 400 })
        }
        customHazards = validation.valid
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
