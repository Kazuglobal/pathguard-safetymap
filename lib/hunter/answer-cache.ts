// =============================================
// きけんハンター 匿名サーバキャッシュ (トラスト境界の格上げ)
// Phase0 はステートレスで、採点の正解鍵がクライアント由来=改ざん可。
// 画像・PII は保存せず「採点に必要な正解鍵のみ」を短TTLで持つことで、
// session 再採点をサーバ権威にする。Upstash Redis を流用し、未設定環境では
// no-op(=現行のクライアント供給で採点、後方互換)。throw しない(ゲームを止めない)。
// =============================================

import type { HunterRegion } from "@/lib/hunter/types"
import type { RiskSeverity } from "@/lib/hazard-game-types"

/** 探索の正解鍵(採点に要る最小フィールドのみ。kidExplanation等は保存しない)。 */
export interface CachedHazardKey {
  id: string
  region: HunterRegion
  severity: RiskSeverity
  /** hit 候補が重なったときの優先度(severity重み×confidence)に使う。 */
  confidence: number
}

/** クイズの正解鍵(place は region、choice は正解ID)。 */
export interface CachedQuizKey {
  id: string
  kind: "place" | "choice"
  correctChoiceId?: string
  answerRegion?: HunterRegion
}

export interface HunterAnswerKey {
  hazards: CachedHazardKey[]
  quiz: CachedQuizKey[]
}

const TTL_SECONDS = 1800 // 30分

let RedisCtor: typeof import("@upstash/redis").Redis | null = null

async function getRedisCtor(): Promise<typeof import("@upstash/redis").Redis | null> {
  if (RedisCtor) return RedisCtor
  try {
    const mod = await import("@upstash/redis")
    RedisCtor = mod.Redis
    return RedisCtor
  } catch {
    return null
  }
}

function isConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  )
}

/**
 * サーバキャッシュ(Upstash)が設定されているか。
 * 呼び出し側(session route)が「未設定なので後方互換フォールバック」と
 * 「設定済みなのにキャッシュミス(=改ざんの可能性)」を区別するために公開する。
 */
export function isAnswerCacheConfigured(): boolean {
  return isConfigured()
}

function cacheKey(sessionId: string): string {
  return `hunter:answer:${sessionId}`
}

/**
 * 正解鍵を保存する。Upstash 未設定・import 失敗・例外時は no-op(throw しない)。
 */
export async function putAnswerKey(sessionId: string, key: HunterAnswerKey): Promise<void> {
  if (!sessionId || !isConfigured()) return
  const Ctor = await getRedisCtor()
  if (!Ctor) return
  try {
    const redis = new Ctor({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    await redis.set(cacheKey(sessionId), JSON.stringify(key), { ex: TTL_SECONDS })
  } catch {
    // 保存失敗は握りつぶす(クライアント供給で採点する後方互換へフォールバック)
  }
}

/**
 * 正解鍵を取得する。未設定・ミス・例外時は null(=クライアント供給で採点)。
 */
export async function getAnswerKey(sessionId: string): Promise<HunterAnswerKey | null> {
  if (!sessionId || !isConfigured()) return null
  const Ctor = await getRedisCtor()
  if (!Ctor) return null
  try {
    const redis = new Ctor({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    const raw = await redis.get(cacheKey(sessionId))
    if (raw == null) return null
    // Upstash は JSON を自動デシリアライズすることがある(文字列/オブジェクト両対応)。
    if (typeof raw === "string") return JSON.parse(raw) as HunterAnswerKey
    return raw as HunterAnswerKey
  } catch {
    return null
  }
}
