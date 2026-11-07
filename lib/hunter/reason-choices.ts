// =============================================
// きけんハンター 理由の3択 (純粋ロジック)
// 場所が当たったあと、理由まで分かっているかを確かめる。
//  - たんけん:「どうして あぶない？」(危険の種類 → KID_REASON_BY_KIND)
//  - あんぜん さがし:「どうして あんしん？」(工夫の種類 → KID_SAFE_REASON_BY_KIND)
//  - 正解 = その種類の理由。誤答 2 つ = 写真に出ていない種類から。正解とまぎらわしい組は使わない。
//  - 並びは対象ごとに決定的(同じ対象なら同じ並び。セッションをまたぐと変わる)。
//  - 種類が other / 無いときは null(質問しない = 場所だけで「わかった」)。
// =============================================

import {
  CONFUSABLE_KIND_GROUPS,
  KID_DANGER_KINDS,
  KID_REASON_BY_KIND,
  type HunterDangerKind,
} from "@/lib/hunter/kid-copy"
import { hashSeed } from "@/lib/hunter/quiz-choices"
import {
  CONFUSABLE_SAFE_KIND_GROUPS,
  HUNTER_SAFE_KINDS,
  KID_SAFE_REASON_BY_KIND,
  type HunterSafeKind,
} from "@/lib/hunter/safe-kinds"

export interface ReasonChoice<K extends string = HunterDangerKind> {
  readonly kind: K
  readonly label: string
}

/** 種類の一覧・理由文・まぎらわしい組(たんけん / あんぜん さがし で差し替える)。 */
interface ReasonTable<K extends string> {
  readonly kinds: readonly K[]
  readonly reasons: Readonly<Record<K, string | null>>
  readonly confusable: ReadonlyArray<ReadonlyArray<K>>
}

const DANGER_TABLE: ReasonTable<HunterDangerKind> = {
  kinds: KID_DANGER_KINDS,
  reasons: KID_REASON_BY_KIND,
  confusable: CONFUSABLE_KIND_GROUPS,
}

const SAFE_TABLE: ReasonTable<HunterSafeKind> = {
  kinds: HUNTER_SAFE_KINDS,
  reasons: KID_SAFE_REASON_BY_KIND,
  confusable: CONFUSABLE_SAFE_KIND_GROUPS,
}

/** 誤答の数(正解と合わせて 3 択)。 */
const DISTRACTOR_COUNT = 2

function askable<K extends string>(table: ReasonTable<K>, kind: K | undefined | null): kind is K {
  return Boolean(kind) && table.reasons[kind as K] != null
}

/** 理由を問える危険の種類か(other・未知・理由文なしは問わない)。 */
export function canAskReason(kind: HunterDangerKind | undefined | null): boolean {
  return askable(DANGER_TABLE, kind)
}

/** 理由を問える工夫の種類か。 */
export function canAskSafeReason(kind: HunterSafeKind | undefined | null): boolean {
  return askable(SAFE_TABLE, kind)
}

/** 誤答の候補。写真に出ている種類はなるべく避け、足りなければ戻す。 */
function distractorPool<K extends string>(table: ReasonTable<K>, kind: K, present: ReadonlySet<K>): K[] {
  const group = table.confusable.find((g) => g.includes(kind))
  const confusable = new Set<K>(group ?? [kind])
  const candidates = table.kinds.filter((k) => k !== kind && askable(table, k) && !confusable.has(k))
  const notPresent = candidates.filter((k) => !present.has(k))
  return notPresent.length >= DISTRACTOR_COUNT ? notPresent : candidates
}

/** seed で決定的に n 個選ぶ(元の配列は変えない)。 */
function pickDeterministic<T>(pool: readonly T[], n: number, seed: number): T[] {
  const picked: T[] = []
  const rest = [...pool]
  let s = seed
  while (picked.length < n && rest.length > 0) {
    const i = s % rest.length
    picked.push(rest[i])
    rest.splice(i, 1)
    s = Math.floor(s / 7) + 13
  }
  return picked
}

function buildChoices<K extends string>(
  table: ReasonTable<K>,
  id: string,
  kind: K | undefined | null,
  presentKinds: readonly (K | undefined | null)[],
): ReasonChoice<K>[] | null {
  if (!askable(table, kind)) return null
  const present = new Set(presentKinds.filter((k): k is K => Boolean(k)))
  const seed = hashSeed(id)
  const distractors = pickDeterministic(distractorPool(table, kind, present), DISTRACTOR_COUNT, seed)
  const wrong = distractors.map((k) => ({ kind: k, label: table.reasons[k] as string }))
  const correct = { kind, label: table.reasons[kind] as string }
  const at = seed % (wrong.length + 1)
  return [...wrong.slice(0, at), correct, ...wrong.slice(at)]
}

/**
 * 危険 1 つぶんの「どうして あぶない？」。質問しないとき(other・kind 無し)は null。
 * hazards は同じ写真の危険全部(誤答から写真に出ている kind を外すため)。
 */
export function buildReasonChoices(
  hazard: { readonly id: string; readonly kind?: HunterDangerKind },
  hazards: readonly { readonly kind?: HunterDangerKind }[],
): ReasonChoice[] | null {
  return buildChoices(DANGER_TABLE, hazard.id, hazard.kind, hazards.map((h) => h.kind))
}

/** 安全の工夫 1 つぶんの「どうして あんしん？」。質問しないとき(other・種類なし)は null。 */
export function buildSafeReasonChoices(
  point: { readonly id: string; readonly safeKind?: HunterSafeKind },
  points: readonly { readonly safeKind?: HunterSafeKind }[],
): ReasonChoice<HunterSafeKind>[] | null {
  return buildChoices(SAFE_TABLE, point.id, point.safeKind, points.map((p) => p.safeKind))
}
