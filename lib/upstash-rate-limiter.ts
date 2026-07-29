import { NextResponse } from 'next/server'

/**
 * Upstash Redis ベースのサーバーレス対応分散レート制限
 *
 * 環境変数 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定の場合は
 * allow-all で graceful fallback（開発環境・Upstash未設定環境でも動作する）
 */

type RateLimitResult = { success: boolean; reset?: number }

let Ratelimit: typeof import('@upstash/ratelimit').Ratelimit | null = null
let Redis: typeof import('@upstash/redis').Redis | null = null

async function getModules() {
  if (Ratelimit && Redis) return { Ratelimit, Redis }
  try {
    const [rl, r] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    Ratelimit = rl.Ratelimit
    Redis = r.Redis
    return { Ratelimit, Redis }
  } catch {
    return null
  }
}

function isConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

async function checkLimit(prefix: string, identifier: string, requests: number, windowSeconds: number): Promise<RateLimitResult> {
  if (!isConfigured()) {
    return { success: true }
  }

  const modules = await getModules()
  if (!modules) return { success: true }
  const { Ratelimit: RL, Redis: R } = modules

  try {
    const redis = new R({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })

    const ratelimit = new RL({
      redis,
      limiter: RL.slidingWindow(requests, `${windowSeconds} s`),
      prefix,
    })

    const { success, reset } = await ratelimit.limit(identifier)
    if (success) return { success: true }
    return { success: false, reset }
  } catch (error) {
    // Upstash 側の障害(到達不能・認証エラー等)でレート制限が本体機能を
    // 道連れにしない。エラーを外へ投げると生の内部メッセージが API レスポンスに
    // 漏れるため、ここで捕捉して docstring 通りの fail-open に倒す。
    console.error(`[rate-limit] ${prefix} check failed, allowing request:`, error)
    return { success: true }
  }
}

/** 汎用API: 60リクエスト/分 */
export async function checkApiRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit('api', identifier, 60, 60)
}

/** Gemini API: 10リクエスト/分 */
export async function checkGeminiRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit('gemini', identifier, 10, 60)
}

/**
 * 画像生成API(Gemini/GPT Image 2共通): 15リクエスト/5分。
 * 正規フローが1操作で複数回呼ぶため(手動解析=5連続、一括生成=9連続、直後の再生成)、
 * 1分窓ではなく5分窓でバーストを許容しつつ、持続的な乱用は
 * 旧設定の5回/分(=最大300回/時)より厳しい実効180回/時に抑える。
 */
export async function checkImageGenerationRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit('image-gen', identifier, 15, 300)
}

/** レート制限超過時の標準レスポンス */
export function rateLimitedResponse(reset?: number): NextResponse {
  const retryAfter = reset ? Math.ceil((reset - Date.now()) / 1000) : 60
  return NextResponse.json(
    { error: 'リクエストが多すぎます。しばらく後にお試しください。' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  )
}
