import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { generateImageWithOpenAIWithModel, FORCED_OPENAI_IMAGE_MODEL } from "@/lib/openai-image"
import {
  buildHazardImagePrompt,
  formatDepthLabel,
  getHazardScenarioOptions,
} from "@/lib/hazard-scenarios"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import type { HazardAreaContext, HazardType } from "@/lib/types"

export const runtime = "nodejs"
export const maxDuration = 180

const BUCKET_NAME = "hazard-simulations"
const MODEL_NAME = FORCED_OPENAI_IMAGE_MODEL

function createPromptSignature(prompt: string): string {
  return createHash("md5").update(prompt).digest("hex")
}

type HazardImageRequest = {
  hazardType: HazardType
  riskLevel: number
  depthMinMeters?: number | null
  depthMaxMeters?: number | null
  areaContext: HazardAreaContext
  scenarioKey: string
  locationLabel?: string
}

function isHazardType(value: unknown): value is HazardType {
  return value === "flood" || value === "tsunami"
}

function isAreaContext(value: unknown): value is HazardAreaContext {
  return (
    value === "residential-school-route" ||
    value === "riverside" ||
    value === "coastal"
  )
}

function parseRequestBody(body: unknown): HazardImageRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }

  const payload = body as Record<string, unknown>
  if (!isHazardType(payload.hazardType)) {
    throw new Error("hazardType must be flood or tsunami")
  }
  if (!isAreaContext(payload.areaContext)) {
    throw new Error("areaContext is invalid")
  }
  if (typeof payload.riskLevel !== "number" || payload.riskLevel < 1 || payload.riskLevel > 5) {
    throw new Error("riskLevel must be between 1 and 5")
  }
  if (typeof payload.scenarioKey !== "string" || payload.scenarioKey.length === 0) {
    throw new Error("scenarioKey is required")
  }

  const allowedScenarioKeys = getHazardScenarioOptions({
    hazardType: payload.hazardType,
    areaContext: payload.areaContext,
  }).map((scenario) => scenario.key)

  if (!allowedScenarioKeys.includes(payload.scenarioKey)) {
    throw new Error("scenarioKey is not allowed for this location")
  }

  return {
    hazardType: payload.hazardType,
    riskLevel: payload.riskLevel,
    depthMinMeters:
      typeof payload.depthMinMeters === "number" ? payload.depthMinMeters : null,
    depthMaxMeters:
      typeof payload.depthMaxMeters === "number" ? payload.depthMaxMeters : null,
    areaContext: payload.areaContext,
    scenarioKey: payload.scenarioKey,
    locationLabel:
      typeof payload.locationLabel === "string" ? payload.locationLabel : undefined,
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) {
    throw new Error("Generated image is not a valid data URL")
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const payload = parseRequestBody(await req.json())
    const prompt = buildHazardImagePrompt({
      hazardType: payload.hazardType,
      riskLevel: payload.riskLevel,
      depthMinMeters: payload.depthMinMeters ?? null,
      depthMaxMeters: payload.depthMaxMeters ?? null,
      areaContext: payload.areaContext,
      scenarioKey: payload.scenarioKey,
      locationLabel: payload.locationLabel,
    })
    const promptSignature = createPromptSignature(prompt)
    const admin = getSupabaseAdmin() as any

    const { data: cachedEntry, error: cacheError } = await admin
      .from("hazard_image_cache")
      .select("public_url, prompt_en, scenario_key, generated_at")
      .eq("hazard_type", payload.hazardType)
      .eq("risk_level", payload.riskLevel)
      .eq("area_context", payload.areaContext)
      .eq("scenario_key", payload.scenarioKey)
      .eq("provider", "openai")
      .eq("prompt_signature", promptSignature)
      .maybeSingle()

    if (cacheError) {
      throw cacheError
    }

    if (cachedEntry?.public_url) {
      return NextResponse.json({
        cached: true,
        imageUrl: cachedEntry.public_url,
        prompt: cachedEntry.prompt_en,
        generatedAt: cachedEntry.generated_at,
        scenarioKey: cachedEntry.scenario_key,
      })
    }

    const generated = await generateImageWithOpenAIWithModel({
      prompt,
      model: MODEL_NAME,
    })

    const image = generated.images[0]
    if (!image?.dataUrl) {
      throw new Error("OpenAI did not return an image")
    }

    const { mimeType, buffer } = parseDataUrl(image.dataUrl)
    const extension = mimeType.includes("jpeg") ? "jpg" : "png"
    const objectPath =
      `${user.id}/${payload.hazardType}-${payload.riskLevel}-${payload.areaContext}-${payload.scenarioKey}-${Date.now()}.${extension}`

    const uploadResult = await admin.storage.from(BUCKET_NAME).upload(objectPath, buffer, {
      upsert: false,
      cacheControl: "3600",
      contentType: mimeType,
    })

    if (uploadResult.error) {
      throw uploadResult.error
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET_NAME).getPublicUrl(objectPath)

    const generatedAt = new Date().toISOString()
    const depthLabel = formatDepthLabel(
      payload.depthMinMeters ?? null,
      payload.depthMaxMeters ?? null,
    )

    const { error: upsertError } = await admin.from("hazard_image_cache").upsert({
      hazard_type: payload.hazardType,
      risk_level: payload.riskLevel,
      area_context: payload.areaContext,
      scenario_key: payload.scenarioKey,
      provider: "openai",
      prompt_signature: promptSignature,
      prompt_en: prompt,
      depth_label: depthLabel,
      storage_path: objectPath,
      public_url: publicUrl,
      status: "ready",
      generated_at: generatedAt,
    }, {
      onConflict: "hazard_type,risk_level,area_context,scenario_key,provider,prompt_signature",
    })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({
      cached: false,
      imageUrl: publicUrl,
      prompt,
      generatedAt,
      scenarioKey: payload.scenarioKey,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status =
      /invalid|required|must/i.test(message) ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
