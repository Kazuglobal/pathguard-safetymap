import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getCloudflareContext } from "@opennextjs/cloudflare"

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
  queryAndLogHazardGateD1,
  type HazardPoint,
} from "@/lib/hazard-zone-gate"
import { actorFromUser } from '@/lib/auth/actor'
import { getServiceActor } from '@/lib/auth/service-actor'
import { getCachedHazardImage, upsertCachedHazardImage } from '@/lib/db/repos/hazard.repo'
import { publicMediaUrl } from '@/lib/media/url'
import { createServerClient } from "@/lib/supabase-server"
import {
  isHazardAreaContext,
  type HazardAreaContext,
  type HazardType,
} from "@/lib/types"
import {
  checkImageGenerationRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"
export const maxDuration = 180

const MODEL_NAME = FORCED_GEMINI_IMAGE_MODEL
const MAX_GENERATED_IMAGE_BYTES = 20 * 1024 * 1024

interface ImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<unknown>
  input(stream: ReadableStream<Uint8Array>): { output(options: { format: 'image/webp'; quality: number }): Promise<{ image(): ReadableStream<Uint8Array> }> }
}
interface MediaBucket {
  put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>
  delete(key: string): Promise<void>
}

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
    !isHazardAreaContext(payload.areaContext) ||
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

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: ArrayBuffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) {
    throw new Error("Generated image is not a valid data URL")
  }

  if (!/^image\/(png|jpeg|webp)$/i.test(match[1])) throw new Error('Generated image type is not allowed')
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"))
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) throw new Error('Generated image size is invalid')
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return { mimeType: match[1], buffer }
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
    const actor = actorFromUser(user)
    const serviceActor = getServiceActor()

    const request = parseRequestBody(await req.json())
    const gateMode = getHazardGateMode()
    const legacyRequest = parseLegacyAttributes(request)
    let payload: ResolvedHazardImageRequest

    if (gateMode === "off") {
      if (!legacyRequest) {
        throw new Error("riskLevel and areaContext are required while the hazard gate is off")
      }
      payload = legacyRequest
    } else if (request.point) {
      const verdict = await queryAndLogHazardGateD1(actor, serviceActor, {
        route: "hazard-image",
        mode: gateMode,
        situation: request.hazardType,
        point: request.point,
        userId: user.id,
        hazardType: request.hazardType,
        toleranceMeters: 30,
      })

      if (gateMode === "log" && legacyRequest) {
        payload = legacyRequest
      } else if (verdict.kind === "inside") {
        payload = {
          hazardType: verdict.zone.hazardType,
          riskLevel: verdict.zone.riskLevel,
          depthMinMeters: verdict.zone.depthMinMeters,
          depthMaxMeters: verdict.zone.depthMaxMeters,
          areaContext: verdict.zone.areaContext,
          scenarioKey: request.scenarioKey,
          locationLabel: `${getHazardAreaLabel(verdict.zone.areaContext)} in Japan`,
        }
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
      await queryAndLogHazardGateD1(actor, serviceActor, {
        route: "hazard-image",
        mode: gateMode,
        situation: request.hazardType,
        point: null,
        userId: user.id,
        hazardType: request.hazardType,
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
    const cachedEntry = await getCachedHazardImage(actor, {
      hazardType: payload.hazardType,
      riskLevel: payload.riskLevel,
      areaContext: payload.areaContext,
      scenarioKey: payload.scenarioKey,
      provider: 'gemini',
      promptSignature,
    })

    if (cachedEntry?.objectKey) {
      return NextResponse.json({
        cached: true,
        imageUrl: publicMediaUrl(cachedEntry.objectKey),
        prompt: cachedEntry.promptEn,
        generatedAt: cachedEntry.generatedAt,
        scenarioKey: cachedEntry.scenarioKey,
      })
    }

    const rateLimit = await checkImageGenerationRateLimit(
      `hazard-image:${user.id}`,
    )
    if (!rateLimit.success) return rateLimitedResponse(rateLimit.reset)

    const generated = await generateImageWithGeminiWithModel({
      prompt,
      model: MODEL_NAME,
    })

    const image = generated.images[0]
    if (!image?.dataUrl) {
      throw new Error("Gemini did not return an image")
    }

    const { mimeType, buffer } = parseDataUrl(image.dataUrl)
    const objectPath =
      `hazard-simulations/${payload.hazardType}-${payload.riskLevel}-${payload.areaContext}-${payload.scenarioKey}-${promptSignature}.webp`
    const { env } = getCloudflareContext()
    const bindings = env as unknown as { IMAGES: ImagesBinding; MEDIA_PUBLIC: MediaBucket }
    const source = () => {
      const stream = new Response(buffer, { headers: { 'content-type': mimeType } }).body
      if (!stream) throw new Error('Generated image stream is unavailable')
      return stream
    }
    await bindings.IMAGES.info(source())
    const transformed = await bindings.IMAGES.input(source()).output({ format: 'image/webp', quality: 85 })
    await bindings.MEDIA_PUBLIC.put(objectPath, transformed.image(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    })
    const publicUrl = publicMediaUrl(objectPath)

    const generatedAt = new Date().toISOString()
    const depthLabel = formatDepthLabel(
      payload.depthMinMeters ?? null,
      payload.depthMaxMeters ?? null,
    )

    try {
      await upsertCachedHazardImage(serviceActor, {
        hazardType: payload.hazardType,
        riskLevel: payload.riskLevel,
        areaContext: payload.areaContext,
        scenarioKey: payload.scenarioKey,
        provider: 'gemini',
        promptSignature,
        promptEn: prompt,
        depthLabel,
        objectKey: objectPath,
        generatedAt,
      })
    } catch (error) {
      await bindings.MEDIA_PUBLIC.delete(objectPath).catch(() => undefined)
      throw error
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
