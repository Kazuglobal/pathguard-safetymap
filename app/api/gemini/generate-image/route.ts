import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGeminiWithModel, FORCED_GEMINI_IMAGE_MODEL } from "@/lib/gemini-image"
import { generateImageWithOpenAIWithModel, FORCED_OPENAI_IMAGE_MODEL } from "@/lib/openai-image"
import { verifyOrRegenerateImages } from "@/lib/disaster-image-verification"
import { SCENE_PRESERVATION_GUARD_SUFFIX } from "@/lib/disaster-image-prompt-fallbacks"
import { createServerClient } from "@/lib/supabase-server"
import { logApiUsage } from "@/lib/api-usage-logger"
import {
  calculateCost,
  calculateOpenAIImageGenerationCost,
  estimateImageGenerationCost,
} from "@/lib/api-cost-calculator"
import { readFileWithSentryContext } from "@/lib/sentry-upload-context"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  getHazardGateMode,
  getHazardGateMessage,
  parseHazardPoint,
  queryAndLogHazardGate,
  type HazardGateClient,
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
import {
  ACCIDENT_SITUATION_PROMPT,
  getPromptById,
} from "@/lib/disaster-scenario-prompts"

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
const INUNDATION_KEYWORDS = /浸水|冠水|洪水|津波|\bflood(?:ed|ing)?\b|\btsunami\b|\binundat(?:e|ed|ing|ion)\b/giu
const INUNDATION_NEGATION_BEFORE = /(?:\bno\b|do\s+not|don't|never|without|must\s+not|avoid(?:ing)?|exclude|forbid(?:den)?|prohibit(?:ed)?)[^,，、.;。；]*$/iu
const INUNDATION_NEGATION_AFTER = /^[^,，、.;。；]{0,40}(?:禁止|描かない|描いてはいけない|描かず|表現しない|含めない|避ける|させない|不要|なし)/iu
const INUNDATION_ANNOTATION_BEFORE = /(?:annotation|overlay|label|legend|warning icons?|risk markers?|risk|注記|注意ラベル|警告アイコン|凡例|オーバーレイ)[^,，、.;。；]*$/iu
const INUNDATION_ANNOTATION_AFTER = /^[^,，、.;。；]{0,120}(?:annotation|overlay|label|legend|warning icons?|risk markers?|risk|注記|注意ラベル|警告アイコン|凡例|オーバーレイ)/iu

function isNegatedInundationMatch(
  clause: string,
  index: number,
  length: number,
): boolean {
  const before = clause.slice(Math.max(0, index - 80), index)
  const after = clause.slice(index + length, index + length + 40)
  return (
    INUNDATION_NEGATION_BEFORE.test(before) ||
    INUNDATION_NEGATION_AFTER.test(after)
  )
}

function isAnnotationOnlyInundationMatch(
  clause: string,
  index: number,
  length: number,
): boolean {
  const before = clause.slice(Math.max(0, index - 120), index)
  const after = clause.slice(index + length, index + length + 120)
  return (
    INUNDATION_ANNOTATION_BEFORE.test(before) ||
    INUNDATION_ANNOTATION_AFTER.test(after)
  )
}

function requestsInundationDepiction(prompt: string): boolean {
  return prompt
    .split(/[\n。.!?！？；;]/u)
    .some((clause) => {
      return [...clause.matchAll(INUNDATION_KEYWORDS)].some((match) => {
        const index = match.index ?? 0
        return !isNegatedInundationMatch(
          clause,
          index,
          match[0].length,
        ) && !isAnnotationOnlyInundationMatch(
          clause,
          index,
          match[0].length,
        )
      })
    })
}

export async function POST(req: NextRequest) {
  let modelName = FORCED_IMAGE_MODEL
  let apiProvider: "gemini" | "openai" = "gemini"
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
    let prompt = typeof promptRaw === "string" ? promptRaw.trim() : ""
    const generationMode = (form.get("generationMode") as string) || undefined
    // 日本語テキスト入り素材(教材ラベル・図解・ポスター等)だけ GPT Image 2 で生成する明示フラグ。
    // プロンプト内容からの自動判定はしない(災害画像は「余計な文字禁止」ガードと矛盾するため誤ルーティングが危険)。
    const textInImage = form.get("textInImage") === "true"
    const situation = (form.get("situation") as string) || undefined
    const point: HazardPoint | null = parseHazardPoint(
      form.get("longitude"),
      form.get("latitude"),
    )
    const file = form.get("image") as File | null

    const gateMode = getHazardGateMode()
    let managedCustomRequiresFloodGate = false
    if (gateMode === "enforce" && (!situation || !IMAGE_SITUATIONS.has(situation))) {
      return NextResponse.json({ error: "situation is required" }, { status: 400 })
    }

    if (gateMode === "enforce" && situation === "custom") {
      const promptId = form.get("promptId")
      const managedPrompt = typeof promptId === "string" ? getPromptById(promptId) : undefined
      if (!managedPrompt) {
        return NextResponse.json(
          { error: "a valid server-managed promptId is required for custom" },
          { status: 400 },
        )
      }
      prompt = managedPrompt.prompt.trim()
      managedCustomRequiresFloodGate = managedPrompt.requiresFloodGate === true
    }

    if (!prompt || prompt.toLowerCase() === "null") {
      return NextResponse.json(
        { error: "prompt must not be empty or null" },
        { status: 400 },
      )
    }

    const inspectPromptText = !(gateMode === "enforce" && situation === "custom")
    const requiresFloodGate =
      situation === "flood" ||
      managedCustomRequiresFloodGate ||
      (inspectPromptText && requestsInundationDepiction(prompt))
    let floodVerdict: Awaited<ReturnType<typeof queryAndLogHazardGate>> | null = null
    if (gateMode !== "off" && requiresFloodGate) {
      const admin = getSupabaseAdmin()
      floodVerdict = await queryAndLogHazardGate(admin as unknown as HazardGateClient, {
        route: "generate-image",
        mode: gateMode,
        situation: situation ?? null,
        point,
        userId: user.id,
        hazardType: "flood",
        toleranceMeters: 0,
      })
    }
    if (gateMode === "enforce" && requiresFloodGate && !point) {
      return NextResponse.json(
        { error: "longitude and latitude are required for inundation simulation" },
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
    if (gateMode === "enforce" && floodVerdict) {
      if (floodVerdict.kind !== "inside") {
        return NextResponse.json(
          {
            error: getHazardGateMessage(floodVerdict, "flood"),
            reason: floodVerdict.kind,
          },
          { status: 422 },
        )
      }
      gateVerifiedPrompt = appendSystemAFloodTruth(prompt)
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

    // ---- GPT Image 2 併用パス(日本語テキスト入り素材専用) ----
    // CJK文字描画は GPT Image 2 が最も正確なため、textInImage=true のときだけ OpenAI へ。
    // 浸水区域ゲート・situation検証は上で通過済み(textInImage はゲートをバイパスしない)。
    // 文字を「入れる」用途なので SCENE_PRESERVATION_GUARD_SUFFIX(余計な文字禁止)は付与せず、
    // 災害画像向けの機械検証(verifyOrRegenerateImages)も対象外。
    // タイムアウトは lib/openai-image.ts 側の 170s が ROUTE_TIMEOUT_MS(175s) 内で先に効く。
    if (textInImage) {
      apiProvider = "openai"
      modelName = FORCED_OPENAI_IMAGE_MODEL
      apiRequestCount = 1
      const openaiResult = await generateImageWithOpenAIWithModel({
        prompt: gateVerifiedPrompt,
        imageBase64,
        imageMimeType,
      })
      modelName = openaiResult.model
      estimatedCostUsd = calculateOpenAIImageGenerationCost(openaiResult.model, openaiResult.usage)

      try {
        logApiUsage({
          api_provider: "openai",
          api_endpoint: "generate-image",
          model_name: modelName,
          request_count: apiRequestCount,
          estimated_cost_usd: estimatedCostUsd,
          success: true,
        })
      } catch { /* fire-and-forget */ }
      return NextResponse.json({ images: openaiResult.images })
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
        api_provider: apiProvider,
        api_endpoint: 'generate-image',
        model_name: modelName,
        request_count: Math.max(apiRequestCount, 1),
        estimated_cost_usd: estimatedCostUsd,
        success: false,
        error_message: message,
      })
    } catch { /* fire-and-forget */ }
    // APIキー未設定(サーバ側の設定不備)はクライアントの認証エラー(401)と区別し、
    // 内部の環境変数名を含む生メッセージをクライアントへ返さない。
    if (/environment variable is not set|Missing GOOGLE_API_KEY/i.test(message)) {
      return NextResponse.json(
        { error: "画像生成サービスが現在利用できません。管理者にお問い合わせください。" },
        { status: 503 }
      )
    }
    const statusCode = (() => {
      if (/unauthorized|forbidden|api.?key|401|403/i.test(message)) return 401
      if (/quota|rate.?limit|429/i.test(message)) return 429
      if (/サポートされていない画像形式|MIME形式|入力画像が大きすぎ/i.test(message)) return 400
      return 500
    })()
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
