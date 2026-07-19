import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { generateImageWithGeminiWithModel, FORCED_GEMINI_IMAGE_MODEL } from "@/lib/gemini-image"
import {
  buildHazardImagePrompt,
  formatDepthLabel,
  getHazardAreaLabel,
  getHazardScenarioOptions,
} from "@/lib/hazard-scenarios"
import {
  getHazardGateMessage,
  getHazardGateMode,
  getHazardGateReason,
  logHazardGateVerdict,
  queryHazardGate,
  type HazardGateLogClient,
  type HazardGateRpcClient,
  type HazardPoint,
} from "@/lib/hazard-zone-gate"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import type { HazardAreaContext, HazardType } from "@/lib/types"
import {
  checkImageGenerationRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"
export const maxDuration = 180

const BUCKET_NAME = "hazard-simulations"
const MODEL_NAME = FORCED_GEMINI_IMAGE_MODEL

function createPromptSignature(prompt: string): string {
  return createHash("md5").update(prompt).digest("hex")
}

type ResolvedHazardImageRequest = {
  hazardType: HazardType
  riskLevel: number
  depthMinMeters: number | null
  depthMaxMeters: number | null
  areaContext: HazardAreaContext
  scenarioKey: string
  locationLabel?: string
}

type HazardImageRequestCore = {
  hazardType: HazardType
  scenarioKey: string
  point: HazardPoint | null
  raw: Record<string, unknown>
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

function parseRequestBody(body: unknown): HazardImageRequestCore {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }

  const payload = body as Record<string, unknown>
  if (!isHazardType(payload.hazardType)) {
    throw new Error("hazardType must be flood or tsunami")
  }
  if (typeof payload.scenarioKey !== "string" || payload.scenarioKey.length === 0) {
    throw new Error("scenarioKey is required")
  }

  const hasLongitude = payload.longitude !== undefined
  const hasLatitude = payload.latitude !== undefined
  let point: HazardPoint | null = null
  if (hasLongitude || hasLatitude) {
    if (
      typeof payload.longitude !== "number" ||
      !Number.isFinite(payload.longitude) ||
      typeof payload.latitude !== "number" ||
      !Number.isFinite(payload.latitude)
    ) {
      throw new Error("longitude and latitude must be finite numbers")
    }
    point = { longitude: payload.longitude, latitude: payload.latitude }
  }

  return {
    hazardType: payload.hazardType,
    scenarioKey: payload.scenarioKey,
    point,
    raw: payload,
  }
}

function parseLegacyAttributes(
  request: HazardImageRequestCore,
): ResolvedHazardImageRequest | null {
  const payload = request.raw
  if (
    !isAreaContext(payload.areaContext) ||
    typeof payload.riskLevel !== "number" ||
    !Number.isInteger(payload.riskLevel) ||
    payload.riskLevel < 1 ||
    payload.riskLevel > 5
  ) {
    return null
  }

  return {
    hazardType: request.hazardType,
    riskLevel: payload.riskLevel,
    depthMinMeters:
      typeof payload.depthMinMeters === "number" &&
      Number.isFinite(payload.depthMinMeters)
        ? payload.depthMinMeters
        : null,
    depthMaxMeters:
      typeof payload.depthMaxMeters === "number" &&
      Number.isFinite(payload.depthMaxMeters)
        ? payload.depthMaxMeters
        : null,
    areaContext: payload.areaContext,
    scenarioKey: request.scenarioKey,
    locationLabel:
      typeof payload.locationLabel === "string" ? payload.locationLabel : undefined,
  }
}

function validateScenario(request: ResolvedHazardImageRequest): void {
  const allowedScenarioKeys = getHazardScenarioOptions({
    hazardType: request.hazardType,
    areaContext: request.areaContext,
  }).map((scenario) => scenario.key)

  if (!allowedScenarioKeys.includes(request.scenarioKey)) {
    throw new Error("scenarioKey is not allowed for this location")
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

    const rateLimit = await checkImageGenerationRateLimit(
      `hazard-image:${user.id}`,
    )
    if (!rateLimit.success) return rateLimitedResponse(rateLimit.reset)

    const request = parseRequestBody(await req.json())
    const gateMode = getHazardGateMode()
    const legacyRequest = parseLegacyAttributes(request)
    const admin = getSupabaseAdmin() as any
    let payload: ResolvedHazardImageRequest

    if (gateMode === "off" && legacyRequest) {
      payload = legacyRequest
    } else if (request.point) {
      const gateStartedAt = Date.now()
      const verdict = await queryHazardGate(
        admin as HazardGateRpcClient,
        request.point,
        request.hazardType,
        { toleranceMeters: 30 },
      )
      await logHazardGateVerdict(admin as HazardGateLogClient, {
        route: "hazard-image",
        mode: gateMode,
        situation: request.hazardType,
        verdict,
        point: request.point,
        userId: user.id,
        latencyMs: Date.now() - gateStartedAt,
      })

      if (verdict.kind === "inside") {
        payload = {
          hazardType: verdict.zone.hazardType,
          riskLevel: verdict.zone.riskLevel,
          depthMinMeters: verdict.zone.depthMinMeters,
          depthMaxMeters: verdict.zone.depthMaxMeters,
          areaContext: verdict.zone.areaContext,
          scenarioKey: request.scenarioKey,
          locationLabel: `${getHazardAreaLabel(verdict.zone.areaContext)} in Japan`,
        }
      } else if (gateMode === "log" && legacyRequest) {
        payload = legacyRequest
      } else {
        return NextResponse.json(
          {
            error: getHazardGateMessage(verdict, request.hazardType),
            reason: getHazardGateReason(verdict),
          },
          { status: 422 },
        )
      }
    } else if (gateMode === "log" && legacyRequest) {
      const verdict = { kind: "unavailable" } as const
      await logHazardGateVerdict(admin as HazardGateLogClient, {
        route: "hazard-image",
        mode: gateMode,
        situation: request.hazardType,
        verdict,
        point: null,
        userId: user.id,
        latencyMs: 0,
      })
      payload = legacyRequest
    } else {
      throw new Error("longitude and latitude are required")
    }

    validateScenario(payload)
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
    const { data: cachedEntry, error: cacheError } = await admin
      .from("hazard_image_cache")
      .select("public_url, prompt_en, scenario_key, generated_at")
      .eq("hazard_type", payload.hazardType)
      .eq("risk_level", payload.riskLevel)
      .eq("area_context", payload.areaContext)
      .eq("scenario_key", payload.scenarioKey)
      .eq("provider", "gemini")
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

    const generated = await generateImageWithGeminiWithModel({
      prompt,
      model: MODEL_NAME,
    })

    const image = generated.images[0]
    if (!image?.dataUrl) {
      throw new Error("Gemini did not return an image")
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
      provider: "gemini",
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
