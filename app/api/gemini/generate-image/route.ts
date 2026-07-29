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
import {
  checkImageGenerationRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"
export const maxDuration = 180

const ROUTE_TIMEOUT_MS = 175_000 // maxDuration(180s) - 5s buffer
const FORCED_IMAGE_MODEL = FORCED_GEMINI_IMAGE_MODEL
const VERIFICATION_MODEL_FOR_COST = "gemini-2.5-flash"
const ESTIMATED_VERIFICATION_INPUT_TOKENS = 1400
const ESTIMATED_VERIFICATION_OUTPUT_TOKENS = 120

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

    // 従量課金の生成系(Gemini/GPT Image 2共通)をユーザー単位で絞る。
    const rateLimit = await checkImageGenerationRateLimit(user.id)
    if (!rateLimit.success) {
      return rateLimitedResponse(rateLimit.reset)
    }

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Use multipart/form-data with fields: prompt (optional), image (optional), generationMode (optional: standard|disaster)" },
        { status: 400 }
      )
    }

    const form = await req.formData()
    const prompt = (form.get("prompt") as string) || undefined
    const generationMode = (form.get("generationMode") as string) || undefined
    // 日本語テキスト入り素材(教材ラベル・図解・ポスター等)だけ GPT Image 2 で生成する明示フラグ。
    // プロンプト内容からの自動判定はしない(災害画像は「余計な文字禁止」ガードと矛盾するため誤ルーティングが危険)。
    const textInImage = form.get("textInImage") === "true"
    const file = form.get("image") as File | null

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
    // 文字を「入れる」用途なので SCENE_PRESERVATION_GUARD_SUFFIX(余計な文字禁止)は付与せず、
    // 災害画像向けの機械検証(verifyOrRegenerateImages)も対象外。
    // タイムアウトは lib/openai-image.ts 側の 170s が ROUTE_TIMEOUT_MS(175s) 内で先に効く。
    if (textInImage) {
      apiProvider = "openai"
      modelName = FORCED_OPENAI_IMAGE_MODEL
      apiRequestCount = 1
      const result = await generateImageWithOpenAIWithModel({
        prompt,
        imageBase64,
        imageMimeType,
      })
      modelName = result.model
      estimatedCostUsd = calculateOpenAIImageGenerationCost(result.model, result.usage)

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
      return NextResponse.json({ images: result.images })
    }

    // standard(本線の可視化/シミュレーション)モードのときだけ、恒久ルール
    // (アスペクト比維持・匿名化・余計な文字禁止)をサーバ側で決定的に付与する。
    // generationMode 未指定(例: /tools/image-gen の自由入力プロンプト)や 'disaster'(カスタム/バッチ)には付けない。
    const applyGuard = generationMode === "standard" && !!imageBase64 && !!prompt?.trim()
    const basePrompt = applyGuard ? `${prompt}\n\n${SCENE_PRESERVATION_GUARD_SUFFIX}` : prompt

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
