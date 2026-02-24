import { NextResponse } from 'next/server'

/**
 * Upstash Redis ベースのサーバーレス対応分散レート制限
 *
 * 環境変数 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定の場合は
 * allow-all で graceful fallback（開発環境・Upstash未設定環境でも動作する）
 */

type RateLimitResult =
  | { success: true }
  | { success: false; reset: number }

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
}

/** 汎用API: 60リクエスト/分 */
export async function checkApiRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit('api', identifier, 60, 60)
}

/** Gemini API: 10リクエスト/分 */
export async function checkGeminiRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit('gemini', identifier, 10, 60)
}

/** レート制限超過時の標準レスポンス */
export function rateLimitedResponse(reset: number): NextResponse {
  return NextResponse.json(
    { error: 'リクエストが多すぎます。しばらく後にお試しください。' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
      },
    }
  )
}
