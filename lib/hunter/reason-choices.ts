// =============================================
// きけんハンター「どうして あぶない？」の3択 (純粋ロジック)
// 場所が当たったあと、理由まで分かっているかを確かめる。
//  - 正解 = その危険の kind の理由(KID_REASON_BY_KIND)。
//  - 誤答 2 つ = 写真に出ていない kind から。正解とまぎらわしい組は使わない。
//  - 並びは危険ごとに決定的(同じ危険なら同じ並び。セッションをまたぐと変わる)。
//  - kind が other / 無いときは null(質問しない = 場所だけで「わかった」)。
// =============================================

import {
  CONFUSABLE_KIND_GROUPS,
  KID_DANGER_KINDS,
  KID_REASON_BY_KIND,
  type HunterDangerKind,
} from "@/lib/hunter/kid-copy"
import { hashSeed } from "@/lib/hunter/quiz-choices"
import type { HunterHazard } from "@/lib/hunter/types"

export interface ReasonChoice {
  readonly kind: HunterDangerKind
  readonly label: string
}

/** 誤答の数(正解と合わせて 3 択)。 */
const DISTRACTOR_COUNT = 2

/** 理由を問える kind か(other・未知・理由文なしは問わない)。 */
export function canAskReason(kind: HunterDangerKind | undefined | null): boolean {
  return Boolean(kind) && KID_REASON_BY_KIND[kind as HunterDangerKind] != null
}

function confusableWith(kind: HunterDangerKind): ReadonlySet<HunterDangerKind> {
  const group = CONFUSABLE_KIND_GROUPS.find((g) => g.includes(kind))
  return new Set(group ?? [kind])
}

/** 誤答の候補。写真に出ている kind はなるべく避け、足りなければ戻す。 */
function distractorPool(kind: HunterDangerKind, presentKinds: ReadonlySet<HunterDangerKind>): HunterDangerKind[] {
  const confusable = confusableWith(kind)
  const askable = KID_DANGER_KINDS.filter((k) => k !== kind && canAskReason(k) && !confusable.has(k))
  const notPresent = askable.filter((k) => !presentKinds.has(k))
  return notPresent.length >= DISTRACTOR_COUNT ? notPresent : askable
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

/**
 * 危険 1 つぶんの理由の3択。質問しないとき(other・kind 無し)は null。
 * hazards は同じ写真の危険全部(誤答から写真に出ている kind を外すため)。
 */
export function buildReasonChoices(
  hazard: Pick<HunterHazard, "id" | "kind">,
  hazards: readonly Pick<HunterHazard, "kind">[],
): ReasonChoice[] | null {
  const kind = hazard.kind
  if (!canAskReason(kind)) return null
  const present = new Set(hazards.map((h) => h.kind).filter((k): k is HunterDangerKind => Boolean(k)))
  const seed = hashSeed(hazard.id)
  const distractors = pickDeterministic(distractorPool(kind, present), DISTRACTOR_COUNT, seed)
  const wrong = distractors.map((k) => ({ kind: k, label: KID_REASON_BY_KIND[k] as string }))
  const correct = { kind, label: KID_REASON_BY_KIND[kind] as string }
  const at = seed % (wrong.length + 1)
  return [...wrong.slice(0, at), correct, ...wrong.slice(at)]
}
