// =============================================
// きけんハンター ガイドモード (フォールバック)
// 事故0件・AI検出0件・解析不能・AIエラー時に、写真の上へ
// 「偽の危険」を置かずにゲームを成立させる。
//  - 写真に依存しない検証済みの安全クイズ(非空間choice)。
//  - 理由別の正直なコピー(解析不能を「安全」と断定しない)。
// 設計書 B5(ダブル空)/逆モードの精神。React/IO/副作用なし。
// =============================================

import type {
  HunterAccidentSummary,
  HunterAnalyzeResult,
  HunterFallbackReason,
  HunterQuizItem,
  HunterSafePoint,
} from "@/lib/hunter/types"
import { accidentTypeToKind, type HunterDangerKind } from "@/lib/hunter/kid-copy"
import { buildRotatedChoices } from "@/lib/hunter/quiz-choices"

interface GuideQuizSeed {
  readonly id: string
  readonly theme: string | null
  /** 関連づける危険 kind(事故テーマ選択用)。 */
  readonly kind: HunterDangerKind | null
  readonly question: string
  /** index0 = 正解 */
  readonly labels: readonly string[]
  readonly explanation: string
}

const GUIDE_QUIZ_SEEDS: readonly GuideQuizSeed[] = [
  {
    id: "guide-crossing",
    theme: "横断",
    kind: "crossing_no_signal",
    question: "信号の ない 道を わたるときは どうする？",
    labels: [
      "止まって 左右を よく 見てから わたる",
      "車の 音が しなければ わたる",
      "手を あげれば 車は 止まる",
      "走って いそいで わたる",
    ],
    explanation: "止まって 見れば 車に すぐ 気づけるよ。",
  },
  {
    id: "guide-blind",
    theme: "見通し",
    kind: "blind_corner",
    question: "見通しの わるい 角では どうする？",
    labels: [
      "いちど 止まって 顔を 出して 見る",
      "そのまま 走って ぬける",
      "車は 来ないと 決めて すすむ",
      "スマホを 見ながら あるく",
    ],
    explanation: "止まれば 曲がってくる 車に 気づけるよ。",
  },
  {
    id: "guide-popout",
    theme: "飛び出し",
    kind: "popout_spot",
    question: "車の かげの そばを とおるときは？",
    labels: [
      "ゆっくり あるいて、出てこないか 見る",
      "いきおいよく 走って ぬける",
      "目を つぶって すすむ",
      "音だけで すすむ",
    ],
    explanation: "かげから 人や 車が 出てくるかも。",
  },
  {
    id: "guide-walk",
    theme: null,
    kind: "narrow_sidewalk",
    question: "道を あるくときは どこを あるく？",
    labels: [
      "歩道や 道の はしを あるく",
      "車道の 真ん中を あるく",
      "スマホを 見ながら あるく",
      "ともだちと 走りまわる",
    ],
    explanation: "車から はなれて あるくと あんしんだよ。",
  },
]

/**
 * seed.id と呼び出し側の seedPrefix(セッション固有、省略時は既定文字列)から
 * 回転量を導く。seedPrefix を省略したまま毎回呼ぶと同じ回転が固定化するため、
 * 呼び出し側(buildGuideMode 経由)は可能な限り sessionId を渡すこと。
 */
function seedToItem(seed: GuideQuizSeed, seedPrefix: string): HunterQuizItem {
  const { choices, correctChoiceId } = buildRotatedChoices(seed.labels, `${seedPrefix}:${seed.id}`)
  return {
    id: seed.id,
    kind: "choice",
    theme: seed.theme,
    question: seed.question,
    choices,
    correctChoiceId,
    explanation: seed.explanation,
    accidentLink: null,
  }
}

/** ガイドモードへ落ちた理由ごとの正直なフォロー文(安全を断定しない)。 */
export const GUIDE_COPY_BY_REASON: Readonly<Record<HunterFallbackReason, string>> = {
  empty:
    "この みちは あぶないところが すくないみたい。じぶんの つうがくろでも さがしてみよう！ゆだんは きんもつ。",
  unusable:
    "しゃしんが うまく 見えなかったよ。あかるい つうがくろの しゃしんで もういちど ためしてね。",
  ai_error: "いま うまく しらべられなかったよ。もういちど ためしてね。",
  parse_error: "いま うまく しらべられなかったよ。もういちど ためしてね。",
}

/**
 * 近隣事故傾向に合うガイドクイズを優先しつつ、最大 max 問を選ぶ。
 * 偽の写真上ターゲットは出さない(quiz のみ)。
 * seed(呼び出し側の sessionId 等)を変えると、正解の表示位置が変わる。
 * 省略時は固定文字列を使うため、同じ質問バンクでは常に同じ回転になる
 * (テスト/呼び出し元がまだ sessionId を持たない場合の後方互換)。
 */
export function selectGuideQuiz(
  accident: HunterAccidentSummary | null,
  max = 3,
  seed?: string,
): HunterQuizItem[] {
  const priorityKind: HunterDangerKind | null = accident?.hasData
    ? accidentTypeToKind(accident.topAccidentType)
    : null

  const ordered = GUIDE_QUIZ_SEEDS.slice().sort((a, b) => {
    const aMatch = priorityKind && a.kind === priorityKind ? 0 : 1
    const bMatch = priorityKind && b.kind === priorityKind ? 0 : 1
    return aMatch - bMatch
  })

  const seedPrefix = seed && seed.trim().length > 0 ? seed : "guide"
  return ordered.slice(0, Math.max(1, max)).map((guideSeed) => seedToItem(guideSeed, seedPrefix))
}

/**
 * ガイドモードの解析結果を組み立てる。写真上に偽の危険は置かない。
 * safePoints があれば逆モード(安全さがし)用に引き継ぐ(empty 時のみ意味を持つ)。
 * seed(呼び出し側の sessionId)を渡すと、ガイドクイズの正解位置がセッションごとに
 * 変わる(省略時は固定回転になり、毎回同じ位置が記憶されてしまう)。
 */
export function buildGuideMode(
  accident: HunterAccidentSummary | null,
  reason: HunterFallbackReason,
  safePoints: readonly HunterSafePoint[] = [],
  seed?: string,
): HunterAnalyzeResult {
  return {
    mode: "guide",
    hazards: [],
    quiz: selectGuideQuiz(accident, 3, seed),
    safePoints,
    noHazardFollow: GUIDE_COPY_BY_REASON[reason],
    usedFallback: true,
    fallbackReason: reason,
  }
}
