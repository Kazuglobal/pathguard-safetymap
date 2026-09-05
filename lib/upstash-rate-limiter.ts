import { NextResponse } from 'next/server'

/**
 * Upstash Redis ベースのサーバーレス対応分散レート制限
 *
 * 環境変数またはSDKが利用できない場合、本番は fail-closed、非本番は
 * allow-all でフォールバックする。
 */

export type RateLimitResult = { success: boolean; reset?: number }
export type PaidApiKind = 'ai' | 'mapbox' | 'image-processing'

let Ratelimit: typeof import('@upstash/ratelimit').Ratelimit | null = null
let Redis: typeof import('@upstash/redis').Redis | null = null
const reportedFallbacks = new Set<RateLimitFallbackReason>()

type RateLimitFallbackReason = 'missing_configuration' | 'module_import_failed'
type UpstashModules = {
  Ratelimit: typeof import('@upstash/ratelimit').Ratelimit
  Redis: typeof import('@upstash/redis').Redis
}
type ModuleLoadResult =
  | { modules: UpstashModules; error?: never }
  | { modules: null; error: unknown }

async function getModules(): Promise<ModuleLoadResult> {
  if (Ratelimit && Redis) return { modules: { Ratelimit, Redis } }
  try {
    const [rl, r] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    Ratelimit = rl.Ratelimit
    Redis = r.Redis
    return { modules: { Ratelimit, Redis } }
  } catch (error) {
    return { modules: null, error }
  }
}

function fallbackResult(
  reason: RateLimitFallbackReason,
  error?: unknown,
): RateLimitResult {
  const failClosed = process.env.NODE_ENV === 'production'
  if (!reportedFallbacks.has(reason)) {
    reportedFallbacks.add(reason)
    console.error(JSON.stringify({
      event: 'rate_limit_fallback',
      reason,
      mode: failClosed ? 'fail_closed' : 'fail_open',
    }))
    void reportFallbackToSentry(reason, failClosed, error)
  }
  return { success: !failClosed }
}

async function reportFallbackToSentry(
  reason: RateLimitFallbackReason,
  failClosed: boolean,
  error?: unknown,
): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs')
    const context = {
      level: 'error' as const,
      tags: {
        component: 'rate_limit',
        rate_limit_fallback_reason: reason,
        rate_limit_fallback_mode: failClosed ? 'fail_closed' : 'fail_open',
      },
    }
    if (error !== undefined) {
      Sentry.captureException?.(error, context)
    } else {
      Sentry.captureMessage?.(`rate_limit_fallback:${reason}`, context)
    }
  } catch {
    // The structured console error above remains available when Sentry is unavailable.
  }
}

function isConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  )
}

async function checkLimit(
  prefix: string,
  identifier: string,
  requests: number,
  windowSeconds: number,
  cost?: number,
): Promise<RateLimitResult> {
  if (!isConfigured()) {
    return fallbackResult('missing_configuration')
  }

  const loaded = await getModules()
  if (!loaded.modules) return fallbackResult('module_import_failed', loaded.error)
  const { Ratelimit: RL, Redis: R } = loaded.modules

  const redis = new R({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const ratelimit = new RL({
    redis,
    limiter: RL.slidingWindow(requests, `${windowSeconds} s`),
    prefix,
  })

  const { success, reset } = cost === undefined
    ? await ratelimit.limit(identifier)
    : await ratelimit.limit(identifier, { rate: cost })
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

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const PAID_API_POLICY: Record<PaidApiKind, {
  perMinute: number
  daily: number
  dailyEnv: string
}> = {
  ai: { perMinute: 10, daily: 30, dailyEnv: 'AI_DAILY_RATE_LIMIT' },
  mapbox: { perMinute: 60, daily: 300, dailyEnv: 'MAPBOX_DAILY_RATE_LIMIT' },
  'image-processing': {
    perMinute: 10,
    daily: 50,
    dailyEnv: 'IMAGE_PROCESS_DAILY_RATE_LIMIT',
  },
}

const DAILY_LIMIT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local cost = tonumber(ARGV[1])
local maximum = tonumber(ARGV[2])
if current + cost > maximum then
  return {0, current}
end
local updated = redis.call('INCRBY', KEYS[1], cost)
redis.call('PEXPIREAT', KEYS[1], tonumber(ARGV[3]))
return {1, updated}
`

function jstDailyWindow(now: number): { date: string; reset: number } {
  const shifted = new Date(now + JST_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth()
  const day = shifted.getUTCDate()
  return {
    date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    reset: Date.UTC(year, month, day + 1) - JST_OFFSET_MS,
  }
}

/**
 * 外部課金API向けのユーザー単位制限。
 * 分次は provider-call units の sliding window、日次は JST 暦日で共有する。
 */
export async function checkPaidApiRateLimit(
  kind: PaidApiKind,
  userId: string,
  cost = 1,
): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(cost) || cost < 1) {
    throw new RangeError('Rate limit cost must be a positive safe integer')
  }
  if (!isConfigured()) return fallbackResult('missing_configuration')

  const policy = PAID_API_POLICY[kind]
  const dailyLimit = boundedPositiveInteger(
    process.env[policy.dailyEnv],
    policy.daily,
    policy.daily,
  )
  if (cost > dailyLimit) return { success: false, reset: jstDailyWindow(Date.now()).reset }

  const minute = await checkLimit(
    `paid:minute:${kind}`,
    userId,
    policy.perMinute,
    60,
    cost,
  )
  if (!minute.success) return minute

  // Resolve the day after the asynchronous minute check (which can cross midnight).
  const { date, reset: dailyReset } = jstDailyWindow(Date.now())

  const loaded = await getModules()
  if (!loaded.modules) return fallbackResult('module_import_failed', loaded.error)
  const redis = new loaded.modules.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  const result = await redis.eval<string[], [number, number]>(
    DAILY_LIMIT_SCRIPT,
    [`paid:daily:${kind}:${date}:${userId}`],
    [String(cost), String(dailyLimit), String(dailyReset)],
  )

  return Number(result[0]) === 1
    ? { success: true }
    : { success: false, reset: dailyReset }
}

function boundedPositiveInteger(
  raw: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

/** 高コスト画像生成: 一括生成（最大14件）を完走できる既定20リクエスト/5分 */
export async function checkImageGenerationRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  const requests = boundedPositiveInteger(
    process.env.IMAGE_GENERATION_RATE_LIMIT_REQUESTS,
    20,
    100,
  )
  const windowSeconds = boundedPositiveInteger(
    process.env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS,
    300,
    3_600,
  )
  return checkLimit('image-generation', identifier, requests, windowSeconds)
}

/** レート制限超過時の標準レスポンス */
export function rateLimitedResponse(reset?: number): NextResponse {
  const retryAfter = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 60
  return NextResponse.json(
    { error: 'リクエストが多すぎます。しばらく後にお試しください。' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  )
}
