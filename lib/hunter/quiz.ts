// =============================================
// きけんハンター AIクイズモード ロジック
// 専用ハンターAIが各危険ポイントに同梱した「設問・妥当な誤答・解説」を、
// 写真連動の良問(HunterQuizItem)へ変換し、サーバ再採点と整合させる。
// 固定テンプレ依存(写真非連動)は撤去し、ガイド用バンクへ降格した。
// =============================================

import { kidAccidentLabel } from "./accident-context"
import { buildRotatedChoices } from "./quiz-choices"
import type { RawAiQuiz } from "@/lib/hunter/ai-schema"
import type {
  HunterAccidentSummary,
  HunterHazard,
  HunterQuizAnswer,
  HunterQuizItem,
  HunterQuizOutcome,
  HunterQuizResult,
  HunterRegion,
  HunterTap,
} from "./types"

const QUIZ_POINTS = 100
/** place 問題の当たり判定マージン(探索の HIT_MARGIN と同じ寛容さ)。 */
export const PLACE_NEAR_MARGIN = 0.1
/** 1セッションの最大出題数(低学年の集中時間に配慮)。 */
export const MAX_QUIZ = 3
/** place(写真タップ)へ昇格する最低 confidence。 */
const PLACE_CONF_MIN = 0.7
/** place へ昇格する region 面積の範囲(小さすぎ/大きすぎは choice 据置)。 */
const PLACE_AREA_MIN = 0.02
const PLACE_AREA_MAX = 0.35

/** 事故データに基づく「リアリティの一言」(断定しない・件数と種類のみ)。 */
function realityLine(accident: HunterAccidentSummary): string {
  if (!accident.hasData) return ""
  if (accident.childInvolved > 0) {
    return `じつは このあたりでは 子どもが かかわる 事故が ${accident.childInvolved}件 あったよ。`
  }
  if (!accident.topAccidentType) {
    return `じつは このあたりでは 事故が ${accident.totalAccidents}件 あったよ。`
  }
  return `じつは このあたりでは 「${kidAccidentLabel(accident.topAccidentType)}」が ${accident.totalAccidents}件 あったよ。`
}

function withReality(base: string, reality: string): string {
  return reality ? `${base} ${reality}` : base
}

function regionArea(region: HunterRegion): number {
  return region.w * region.h
}

function isPlaceEligible(hazard: HunterHazard): boolean {
  if (hazard.confidence < PLACE_CONF_MIN) return false
  const area = regionArea(hazard.region)
  return area >= PLACE_AREA_MIN && area <= PLACE_AREA_MAX
}

function themeFor(
  hazard: HunterHazard,
  accident?: HunterAccidentSummary,
): string | null {
  // hazard.accidentLink は sanitizeDangerPoints で既に kidAccidentLabel を通過済み
  // (子ども向け語彙が保証済み)なので、ここで再度かけない(二重適用による劣化防止)。
  if (hazard.accidentLink) return hazard.accidentLink
  if (accident?.hasData && accident.topAccidentType) {
    return kidAccidentLabel(accident.topAccidentType)
  }
  return null
}

/**
 * 専用ハンターAI由来の危険ポイント(hazards)と、その同梱クイズ素材(materials)から
 * 写真連動のクイズを生成する。materials[i] は hazards[i] に対応する。
 * - 高信頼&適度な大きさの点だけ place(写真タップ)へ昇格(誤審を抑止)。
 * - それ以外は同じ点の choice(4択)へ。各点は必ず choice 素材を持つ。
 * - 変化をつけるため place は最大 ceil(max/2) 件。
 */
export function buildQuizItemsFromAi(
  hazards: readonly HunterHazard[],
  materials: readonly RawAiQuiz[],
  accident?: HunterAccidentSummary,
  max: number = MAX_QUIZ,
): HunterQuizItem[] {
  const limit = Math.max(1, max)
  const reality = accident ? realityLine(accident) : ""
  const placeBudget = Math.ceil(limit / 2)
  const items: HunterQuizItem[] = []
  let placeCount = 0

  const count = Math.min(hazards.length, materials.length, limit)
  for (let i = 0; i < count; i += 1) {
    const hazard = hazards[i]
    const material = materials[i]
    const theme = themeFor(hazard, accident)

    if (isPlaceEligible(hazard) && placeCount < placeBudget) {
      placeCount += 1
      items.push({
        id: `q-place-${i}`,
        kind: "place",
        theme,
        question: `「${hazard.type}」は どこかな？しゃしんを タップして さがそう！`,
        answerHazardId: hazard.id,
        answerRegion: hazard.region,
        explanation: withReality(hazard.kidExplanation, reality),
        accidentLink: hazard.accidentLink ?? null,
      })
      continue
    }

    // seed は hazard.id(= `${sessionId}-${i}` を含む)を使い、正解の表示位置が
    // 写真・セッションをまたいで固定化されない(記憶で解けない)ようにする。
    const { choices, correctChoiceId } = buildRotatedChoices(material.choices, hazard.id)
    items.push({
      id: `q-choice-${i}`,
      kind: "choice",
      theme,
      question: material.question,
      choices,
      correctChoiceId,
      explanation: withReality(material.explanation, reality),
      accidentLink: hazard.accidentLink ?? null,
    })
  }

  return items
}

// ---- 採点 ----

function regionContains(tap: HunterTap, region: HunterRegion, margin: number): boolean {
  const left = region.x - margin
  const top = region.y - margin
  const right = region.x + region.w + margin
  const bottom = region.y + region.h + margin
  return tap.x >= left && tap.x <= right && tap.y >= top && tap.y <= bottom
}

export function judgeQuizAnswer(
  item: HunterQuizItem,
  answer: HunterQuizAnswer | undefined,
): HunterQuizOutcome {
  let correct = false
  if (answer) {
    if (item.kind === "place" && answer.tap && item.answerRegion) {
      correct = regionContains(answer.tap, item.answerRegion, PLACE_NEAR_MARGIN)
    } else if (item.kind === "choice" && answer.choiceId) {
      correct = answer.choiceId === item.correctChoiceId
    }
  }
  return { itemId: item.id, correct, points: correct ? QUIZ_POINTS : 0 }
}

export function scoreQuiz(
  items: readonly HunterQuizItem[],
  answers: readonly HunterQuizAnswer[],
): HunterQuizResult {
  const byId = new Map(answers.map((a) => [a.itemId, a]))
  const outcomes = items.map((item) => judgeQuizAnswer(item, byId.get(item.id)))
  const correct = outcomes.filter((o) => o.correct).length
  const score = outcomes.reduce((sum, o) => sum + o.points, 0)
  return { score, correct, total: items.length, outcomes }
}
