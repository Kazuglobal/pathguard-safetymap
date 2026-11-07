// =============================================
// きけんハンター session API のクライアント側契約 (純粋ロジック + fetch ラッパー)
// - 失敗時に 0 点の結果を「捏造」しない。ok:false と子ども向けの理由を返す。
// - explore(matches)/quiz(correct) の応答差をここで吸収する。
// =============================================

import { normalizedAccuracy, type HunterMissionReward } from "@/lib/hunter/rewards"
import type { HunterDiscovery } from "@/lib/hunter/types"

export interface HunterSessionSummary {
  readonly score: number
  readonly matches: number
  readonly total: number
  readonly comboMax: number
  /** きょう この あそびかたで はじめて みつけたときだけ 5。 */
  readonly pointsAwarded: number
  readonly persistError: boolean
  readonly missionsCompleted: readonly HunterMissionReward[]
  /** 理由まで合った数(旧ルール・クイズは matches と同じ)。 */
  readonly understood: number
  /** 0..100 の達成度(星の元)。 */
  readonly accuracy: number
  /** 採点ルールの版(1=旧 / 2=虫めがね+理由)。 */
  readonly rules: number
  /** 虫めがねののこり。旧ルール・クイズは null。 */
  readonly magnifiersLeft: number | null
  /**
   * サーバが数えた発見(見つけた順)。こたえあわせ・結果画面はこれを正とする(0 件でも)。
   * 応答に discoveries が無い(旧サーバ・クイズ)ときだけ null。
   */
  readonly discoveries: readonly HunterDiscovery[] | null
}

function toDiscoveries(value: unknown): HunterDiscovery[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
    .filter((d) => typeof d.hazardId === "string" && d.hazardId.length > 0)
    .map((d) => ({ hazardId: d.hazardId as string, understood: d.understood === true }))
}

export type HunterSessionFailureKind = "expired" | "network" | "server"

export interface HunterSessionFailure {
  readonly kind: HunterSessionFailureKind
  readonly message: string
}

/**
 * 単一形状(strictNullChecks:false では判別共用体の絞り込みが効かないため)。
 * ok=true なら result、false なら failure が入る。
 */
export interface HunterSessionOutcome {
  readonly ok: boolean
  readonly result?: HunterSessionSummary
  readonly failure?: HunterSessionFailure
}

/** 子ども向け(否定しない・次の行動がわかる)。 */
export const SESSION_FAILURE_COPY: Readonly<Record<HunterSessionFailureKind, string>> = {
  expired: "じかんが たちすぎて、ポイントを かぞえられなかったよ。もういちど AIに 見てもらおう。",
  network: "つうしんが うまく いかなかったよ。でんぱの いい ところで もういちど ためしてね。",
  server: "いま ポイントを かぞえられなかったよ。すこし まってから もういちど ためしてね。",
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/** サーバ応答 → 表示用サマリ。欠けたフィールドは安全側の既定。 */
export function toSessionSummary(body: unknown, fallbackTotal: number): HunterSessionSummary {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const missions = Array.isArray(b.missionsCompleted) ? b.missionsCompleted : []
  const matches = Math.max(0, num(b.matches, num(b.correct)))
  const total = Math.max(0, num(b.total, fallbackTotal))
  const rules = num(b.rules, 1)
  const budget = num(b.budget, 0)
  return {
    score: Math.max(0, num(b.score)),
    matches,
    total,
    comboMax: Math.max(0, num(b.comboMax)),
    pointsAwarded: Math.max(0, num(b.pointsAwarded)),
    persistError: b.persistError === true,
    missionsCompleted: missions
      .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object")
      .filter((m) => typeof m.title === "string" && m.title.length > 0)
      .map((m) => ({ title: m.title as string, rewardPoints: Math.max(0, num(m.rewardPoints)) })),
    understood: Math.max(0, Math.min(matches, num(b.understood, matches))),
    accuracy: Math.max(0, Math.min(100, num(b.accuracy, normalizedAccuracy(matches, total)))),
    rules,
    magnifiersLeft: rules >= 2 && budget > 0 ? Math.max(0, budget - Math.max(0, num(b.misses))) : null,
    discoveries: toDiscoveries(b.discoveries),
  }
}

export function classifySessionFailure(status: number, body: unknown): HunterSessionFailure {
  const code = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined
  const kind: HunterSessionFailureKind =
    status === 409 || code === "session_expired" ? "expired" : status <= 0 ? "network" : "server"
  return { kind, message: SESSION_FAILURE_COPY[kind] }
}

/**
 * POST /api/hunter/session。成功なら result、失敗なら理由(結果は捏造しない)。
 * fetchImpl はテスト差し替え用。
 */
export async function postHunterSession(
  payload: Record<string, unknown>,
  fallbackTotal: number,
  fetchImpl: typeof fetch = fetch,
): Promise<HunterSessionOutcome> {
  let response: Response
  try {
    response = await fetchImpl("/api/hunter/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, failure: classifySessionFailure(0, null) }
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, failure: classifySessionFailure(response.status, body) }
  return { ok: true, result: toSessionSummary(body, fallbackTotal) }
}
