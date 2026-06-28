// =============================================
// きけんハンター AIクイズモード ロジック (Phase 2 / 設計書 モードB)
// 事故傾向 + AI検出から、出題と採点を行う純粋ロジック。
// =============================================

import { kidAccidentLabel } from "./accident-context"
import type {
  HunterAccidentSummary,
  HunterHazard,
  HunterQuizAnswer,
  HunterQuizChoice,
  HunterQuizItem,
  HunterQuizOutcome,
  HunterQuizResult,
  HunterRegion,
  HunterTap,
} from "./types"

const QUIZ_POINTS = 100
/** place 問題の当たり判定マージン（exploreと同様に少し広め） */
const PLACE_NEAR_MARGIN = 0.06
const DEFAULT_MAX_ITEMS = 3

// ---- 4択テンプレート（事故タイプのキーワードで選ぶ） ----

interface ChoiceTemplate {
  readonly keywords: readonly string[]
  readonly question: string
  readonly correct: string
  readonly distractors: readonly [string, string, string]
}

const CHOICE_TEMPLATES: readonly ChoiceTemplate[] = [
  {
    keywords: ["出会い", "見通", "交差", "出合"],
    question: "見通しの悪い角ではどうする？",
    correct: "止まって左右をよく見る",
    distractors: ["走って進む", "スマホを見ながら歩く", "車は来ないと決めつける"],
  },
  {
    keywords: ["横断", "歩行"],
    question: "道路を渡るときはどうする？",
    correct: "手をあげて左右を見てから渡る",
    distractors: ["ななめに渡る", "車の前を走る", "下を向いて渡る"],
  },
  {
    keywords: ["飛び出", "とびだし", "飛出"],
    question: "物陰があるときはどうする？",
    correct: "止まって車が来ないか確かめる",
    distractors: ["いきおいよく飛び出す", "目をつぶって進む", "音だけで決める"],
  },
  {
    keywords: ["右折", "左折", "まがり", "曲"],
    question: "車が曲がってくる角ではどうする？",
    correct: "車と目を合わせて待ってもらう",
    distractors: ["車は止まると信じる", "急いで渡る", "後ろを向いて歩く"],
  },
]

const DEFAULT_TEMPLATE: ChoiceTemplate = {
  keywords: [],
  question: "安全に歩くにはどうする？",
  correct: "まわりをよく見て歩く",
  distractors: ["走りながらスマホを見る", "車道の真ん中を歩く", "左右を見ないで進む"],
}

function pickChoiceTemplate(theme: string | null): ChoiceTemplate {
  if (!theme) return DEFAULT_TEMPLATE
  return (
    CHOICE_TEMPLATES.find((t) => t.keywords.some((k) => theme.includes(k))) ??
    DEFAULT_TEMPLATE
  )
}

/** 事故データに基づく「リアリティの一言」（断定しない・件数と種類のみ） */
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

/** 正解を含む4択を、item ごとに決定的な位置へ配置（ランダム非使用） */
function buildChoices(
  template: ChoiceTemplate,
  rotation: number,
): { choices: HunterQuizChoice[]; correctChoiceId: string } {
  const labels = [template.correct, ...template.distractors]
  const correctId = "c0"
  // ラベルに安定IDを付与（c0 が正解）
  const withIds: HunterQuizChoice[] = labels.map((label, i) => ({ id: `c${i}`, label }))
  // 正解が毎回同じ位置に来ないよう、決定的に回転させる
  const shift = ((rotation % withIds.length) + withIds.length) % withIds.length
  const rotated = withIds.slice(shift).concat(withIds.slice(0, shift))
  return { choices: rotated, correctChoiceId: correctId }
}

/**
 * 出題を生成する。
 * - 写真内に危険があれば「その場所をタップ」(place)
 * - 事故データがあれば そのテーマの安全行動を問う (choice)
 * - どちらも無ければ 一般的な安全行動 (choice)
 */
export function buildQuizItems(
  hazards: readonly HunterHazard[],
  accident: HunterAccidentSummary,
  max: number = DEFAULT_MAX_ITEMS,
): HunterQuizItem[] {
  const limit = Math.max(1, max)
  const items: HunterQuizItem[] = []
  const reality = realityLine(accident)
  // rawTheme: テンプレ選択（マッチング）用の元ラベル / theme: 表示用の子ども向けラベル
  const rawTheme = accident.topAccidentType
  const theme = rawTheme ? kidAccidentLabel(rawTheme) : null

  // choice 問題を1つは入れる（テーマ駆動）。place の枠を残す。
  const placeBudget = Math.max(1, limit - 1)

  hazards.slice(0, placeBudget).forEach((h, i) => {
    items.push({
      id: `q-place-${i}`,
      kind: "place",
      theme,
      question: `「${h.type}」はどこかな？写真をタップしてさがそう！`,
      answerHazardId: h.id,
      answerRegion: h.region,
      explanation: reality ? `${h.safeAction} ${reality}` : h.safeAction,
    })
  })

  if (items.length < limit) {
    const template = pickChoiceTemplate(rawTheme)
    const { choices, correctChoiceId } = buildChoices(template, items.length + 1)
    items.push({
      id: `q-choice-0`,
      kind: "choice",
      theme,
      question: template.question,
      choices,
      correctChoiceId,
      explanation: reality
        ? `正解は「${template.correct}」。${reality}`
        : `正解は「${template.correct}」だよ。`,
    })
  }

  return items.slice(0, limit)
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
