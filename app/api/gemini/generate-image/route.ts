import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGeminiWithModel, FORCED_GEMINI_IMAGE_MODEL } from "@/lib/gemini-image"
import { verifyOrRegenerateImages } from "@/lib/disaster-image-verification"
import { SCENE_PRESERVATION_GUARD_SUFFIX } from "@/lib/disaster-image-prompt-fallbacks"
import { createServerClient } from "@/lib/supabase-server"
import { logApiUsage } from "@/lib/api-usage-logger"
import { calculateCost, estimateImageGenerationCost } from "@/lib/api-cost-calculator"
import { readFileWithSentryContext } from "@/lib/sentry-upload-context"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  getHazardGateMode,
  getHazardGateMessage,
  logHazardGateVerdict,
  queryHazardGate,
  type HazardGateLogClient,
  type HazardGateRpcClient,
  type HazardPoint,
} from "@/lib/hazard-zone-gate"
import {
  checkImageGenerationRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"
import { appendSystemAFloodTruth } from "@/lib/system-a-simulation"
import { fetchNearbyAccidentStats } from "@/lib/traffic-accident/server"
import { ACCIDENT_IMAGE_CONTEXT_PARAMS } from "@/lib/accident-stats-year-window"
import { buildAccidentPromptContext } from "@/lib/accident-prompt-context"
import { ACCIDENT_SITUATION_PROMPT } from "@/lib/disaster-scenario-prompts"

export const runtime = "nodejs"
export const maxDuration = 180

const ROUTE_TIMEOUT_MS = 175_000 // maxDuration(180s) - 5s buffer
const FORCED_IMAGE_MODEL = FORCED_GEMINI_IMAGE_MODEL
const VERIFICATION_MODEL_FOR_COST = "gemini-2.5-flash"
const ESTIMATED_VERIFICATION_INPUT_TOKENS = 1400
const ESTIMATED_VERIFICATION_OUTPUT_TOKENS = 120

const IMAGE_SITUATIONS = new Set([
  "viz",
  "earthquake",
  "typhoon",
  "flood",
  "fire",
  "accident",
  "custom",
])
const INUNDATION_KEYWORDS = /浸水|洪水|津波|\bflood\b|\btsunami\b|\binundation\b/iu

export async function POST(req: NextRequest) {
  let modelName = FORCED_IMAGE_MODEL
  let apiRequestCount = 0
  let estimatedCostUsd = 0
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

    const rateLimit = await checkImageGenerationRateLimit(
      `generate-image:${user.id}`,
    )
    if (!rateLimit.success) return rateLimitedResponse(rateLimit.reset)

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Use multipart/form-data with fields: prompt (optional), image (optional), generationMode (optional: standard|disaster)" },
        { status: 400 }
      )
    }

    const form = await req.formData()
    const promptRaw = form.get("prompt")
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : ""
    const generationMode = (form.get("generationMode") as string) || undefined
    const situation = (form.get("situation") as string) || undefined
    const longitudeRaw = form.get("longitude")
    const latitudeRaw = form.get("latitude")
    const longitude =
      typeof longitudeRaw === "string" && longitudeRaw.trim().length > 0
        ? Number(longitudeRaw)
        : Number.NaN
    const latitude =
      typeof latitudeRaw === "string" && latitudeRaw.trim().length > 0
        ? Number(latitudeRaw)
        : Number.NaN
    const point: HazardPoint | null =
      Number.isFinite(longitude) && Number.isFinite(latitude)
        ? { longitude, latitude }
        : null
    const file = form.get("image") as File | null

    const gateMode = getHazardGateMode()
    if (!prompt || prompt.toLowerCase() === "null") {
      return NextResponse.json(
        { error: "prompt must not be empty or null" },
        { status: 400 },
      )
    }

    if (gateMode === "enforce" && (!situation || !IMAGE_SITUATIONS.has(situation))) {
      return NextResponse.json({ error: "situation is required" }, { status: 400 })
    }

    if (
      gateMode === "enforce" &&
      situation !== "flood" &&
      situation !== "custom" &&
      INUNDATION_KEYWORDS.test(prompt)
    ) {
      return NextResponse.json(
        {
          error: "浸水シミュレーションは flood situation と区域判定が必要です",
          reason: "inundation_keyword",
        },
        { status: 422 },
      )
    }

    if (gateMode === "enforce" && situation === "flood" && !point) {
      return NextResponse.json(
        { error: "longitude and latitude are required for flood" },
        { status: 400 },
      )
    }

    if (situation === "accident" && !point) {
      return NextResponse.json(
        { error: "longitude and latitude are required for accident" },
        { status: 400 },
      )
    }

    let gateVerifiedPrompt = prompt
    if (gateMode !== "off" && situation === "flood" && point) {
      const admin = getSupabaseAdmin()
      const gateStartedAt = Date.now()
      const verdict = await queryHazardGate(
        admin as unknown as HazardGateRpcClient,
        point,
        "flood",
        { toleranceMeters: 0 },
      )
      await logHazardGateVerdict(
        admin as unknown as HazardGateLogClient,
        {
          route: "generate-image",
          mode: gateMode,
          situation,
          verdict,
          point,
          userId: user.id,
          latencyMs: Date.now() - gateStartedAt,
        },
      )
      if (gateMode === "enforce" && verdict.kind !== "inside") {
        return NextResponse.json(
          { error: getHazardGateMessage(verdict, "flood"), reason: verdict.kind },
          { status: 422 },
        )
      }
      if (gateMode === "enforce" && verdict.kind === "inside") {
        gateVerifiedPrompt = appendSystemAFloodTruth(prompt)
      }
    }

    if (situation === "accident" && point) {
      const stats = await fetchNearbyAccidentStats(
        supabase,
        point,
        ACCIDENT_IMAGE_CONTEXT_PARAMS,
      )
      const accidentContext = buildAccidentPromptContext(stats)
      if (!accidentContext) {
        return NextResponse.json(
          {
            error: "この地点周辺の事故統計データはありません",
            reason: "no_accident_data",
          },
          { status: 422 },
        )
      }
      gateVerifiedPrompt = `${ACCIDENT_SITUATION_PROMPT}\n\n${accidentContext}`
    }

    let imageBase64: string | undefined
    let imageMimeType: string | undefined

    if (file) {
      const buf = Buffer.from(
        await readFileWithSentryContext({
          route: "/api/gemini/generate-image",
          fieldName: "image",
          file,
        }),
      )
      imageBase64 = buf.toString("base64")
      imageMimeType = file.type || "image/png"
    }


    // standard(本線の可視化/シミュレーション)モードのときだけ、恒久ルール
    // (アスペクト比維持・匿名化・余計な文字禁止)をサーバ側で決定的に付与する。
    // generationMode 未指定(例: /tools/image-gen の自由入力プロンプト)や 'disaster'(カスタム/バッチ)には付けない。
    const applyGuard = generationMode === "standard" && !!imageBase64 && !!gateVerifiedPrompt
    const basePrompt = applyGuard
      ? `${gateVerifiedPrompt}\n\n${SCENE_PRESERVATION_GUARD_SUFFIX}`
      : gateVerifiedPrompt

    // 生成プロンプトに是正サフィックスを足して呼び直せるようにする（再生成用）。
    const runGeneration = async (correctiveSuffix?: string) => {
      apiRequestCount += 1
      const result = await generateImageWithGeminiWithModel({
        prompt: correctiveSuffix ? [basePrompt, correctiveSuffix].filter(Boolean).join("\n\n") : basePrompt,
        imageBase64,
        imageMimeType,
        model: FORCED_IMAGE_MODEL,
      })
      modelName = result.model
      return result
    }

    let routeTimeoutId: ReturnType<typeof setTimeout> | undefined
    const result = await (async () => {
      try {
        return await Promise.race([
          (async () => {
            // 一次生成 → 生成後の機械検証。混入・匿名化漏れがあれば1回だけ是正再生成する。
            const first = await runGeneration()
            const verified = await verifyOrRegenerateImages({
              images: first.images,
              regenerate: async (correctiveSuffix) => (await runGeneration(correctiveSuffix)).images,
            })
            apiRequestCount += verified.verificationRequestCount
            estimatedCostUsd =
              estimateImageGenerationCost(first.model, apiRequestCount - verified.verificationRequestCount) +
              calculateCost({
                provider: "gemini",
                model: VERIFICATION_MODEL_FOR_COST,
                inputTokens: verified.verificationRequestCount * ESTIMATED_VERIFICATION_INPUT_TOKENS,
                outputTokens: verified.verificationRequestCount * ESTIMATED_VERIFICATION_OUTPUT_TOKENS,
              })
            return { images: verified.images, model: first.model, warning: verified.warning }
          })(),
          new Promise<never>((_, reject) => {
            routeTimeoutId = setTimeout(
              () => reject(new Error("画像生成がタイムアウトしました。しばらく待ってから再度お試しください。")),
              ROUTE_TIMEOUT_MS
            )
          }),
        ])
      } finally {
        if (routeTimeoutId !== undefined) clearTimeout(routeTimeoutId)
      }
    })()
    modelName = result.model

    try {
      logApiUsage({
        api_provider: 'gemini',
        api_endpoint: 'generate-image',
        model_name: modelName,
        request_count: apiRequestCount,
        estimated_cost_usd: estimatedCostUsd,
        success: true,
      })
    } catch { /* fire-and-forget */ }
    return NextResponse.json({
      images: result.images,
      ...(result.warning ? { warning: result.warning } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    try {
      logApiUsage({
        api_provider: 'gemini',
        api_endpoint: 'generate-image',
        model_name: modelName,
        request_count: Math.max(apiRequestCount, 1),
        estimated_cost_usd: estimatedCostUsd,
        success: false,
        error_message: message,
      })
    } catch { /* fire-and-forget */ }
    const statusCode = (() => {
      if (/unauthorized|forbidden|api.?key|401|403/i.test(message)) return 401
      if (/quota|rate.?limit|429/i.test(message)) return 429
      if (/サポートされていない画像形式|MIME形式|入力画像が大きすぎ/i.test(message)) return 400
      return 500
    })()
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
