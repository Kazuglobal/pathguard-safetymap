// =============================================
// きけんハンター 子ども向け語彙の単一の真実 (純粋・定数のみ)
// AIスキーマ(ai-schema) / バリデーション(validation) / サニタイズ(sanitize) /
// クイズ(quiz) が共有する「危険の種類」と、その検証済み子ども向け文。
//
// 設計方針:
// - kind は英語enum(ロジック/分析用)。画面には出さない。
// - 表示ラベル(kidLabel)と説明文(kidExplanation/safeAction)は、
//   必ず furigana 辞書(lib/hunter/furigana.ts)でルビが付く漢字だけで書く。
// - AIが英語ラベル・空文・難語を返したとき、ここの検証済み文へ安全に置換する。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"

/** 通学路で「立ち止まって確かめるべき状況」の種類 (閉じた語彙)。 */
export const KID_DANGER_KINDS = [
  "blind_corner", // 見通しの悪い角
  "popout_spot", // 物陰からの飛び出し地点
  "crossing_no_signal", // 信号のない横断
  "turning_car", // 曲がってくる車(右左折・内輪差)
  "narrow_sidewalk", // せまい歩道/路側帯
  "parked_car_shadow", // 停車中の車のかげ(死角)
  "falling_object", // 落ちてくるもの
  "flood_dip", // 水がたまりやすい所
  "other", // その他(分類不能)
] as const

export type HunterDangerKind = (typeof KID_DANGER_KINDS)[number]

const KIND_SET: ReadonlySet<string> = new Set(KID_DANGER_KINDS)

/** 文字列が既知の kind か判定する。未知は false。 */
export function isHunterDangerKind(value: unknown): value is HunterDangerKind {
  return typeof value === "string" && KIND_SET.has(value)
}

/** 未知の kind を "other" に矯正する。 */
export function normalizeKind(value: unknown): HunterDangerKind {
  return isHunterDangerKind(value) ? value : "other"
}

/** kind -> 画面表示用のやさしいラベル (furigana 辞書でルビが付く漢字のみ)。 */
export const KID_LABEL_BY_KIND: Readonly<Record<HunterDangerKind, string>> = {
  blind_corner: "見通しの悪い角",
  popout_spot: "飛び出しに注意",
  crossing_no_signal: "信号のない横断",
  turning_car: "曲がってくる車",
  narrow_sidewalk: "せまい歩道",
  parked_car_shadow: "車のかげ",
  falling_object: "落ちてくるもの",
  flood_dip: "水がたまる道",
  other: "気をつけるところ",
}

/** kind -> 検証済みの既定 whyDangerous / safeAction (場所固有AI文の安全フォールバック)。 */
export const KID_COPY_BY_KIND: Readonly<
  Record<HunterDangerKind, { readonly whyDangerous: string; readonly safeAction: string }>
> = {
  blind_corner: {
    whyDangerous: "曲がり角の むこうが 見えにくいよ。",
    safeAction: "いちど 止まって、左右を よく 見よう。",
  },
  popout_spot: {
    whyDangerous: "物陰から 人や 車が 出てくるかも。",
    safeAction: "とまって、車が 来ないか 確かめよう。",
  },
  crossing_no_signal: {
    whyDangerous: "信号が ない 道は 車に 気をつけてね。",
    safeAction: "手を あげて、車が 止まってから わたろう。",
  },
  turning_car: {
    whyDangerous: "曲がってくる 車から きみが 見えにくいよ。",
    safeAction: "車と 目を 合わせて、待ってから わたろう。",
  },
  narrow_sidewalk: {
    whyDangerous: "歩道が せまいと 車道に 近くなるよ。",
    safeAction: "道の はしを ゆっくり 歩こう。",
  },
  parked_car_shadow: {
    whyDangerous: "止まっている 車の かげは 見えにくいよ。",
    safeAction: "車の そばは ゆっくり 歩こう。",
  },
  falling_object: {
    whyDangerous: "上から 落ちてくる ものが あるかも。",
    safeAction: "上を 見て、はなれて 歩こう。",
  },
  flood_dip: {
    whyDangerous: "雨の 日は 水が たまりやすいよ。",
    safeAction: "水たまりは よけて 歩こう。",
  },
  other: {
    whyDangerous: "ここは ちょっと 気をつけて みてね。",
    safeAction: "まわりを よく 見て、ゆっくり 歩こう。",
  },
}

/** 安全の工夫(逆モード)で、AI文言が空/英語のときに使う検証済みフォールバック。 */
export const SAFE_POINT_FALLBACK = {
  type: "あんぜんの くふう",
  whyGood: "ここは あんぜんを まもる くふうだよ。",
} as const

/** quiz 素材(question/choices/explanation)の型。ai-schema.ts の RawAiQuiz と同形。 */
export interface KidQuizFallback {
  readonly question: string
  /** index0 = 正解 */
  readonly choices: readonly string[]
  readonly explanation: string
}

/**
 * kind -> 検証済みの既定クイズ素材(AI同梱の question/choices/explanation が
 * 空/英語混入のときに、whyDangerous/safeAction と同じ境界で丸ごと差し替える)。
 * 部分置換ではなく全体差し替えにするのは、正解位置(choices[0])と explanation の
 * 対応が崩れないようにするため。
 */
export const KID_QUIZ_FALLBACK_BY_KIND: Readonly<Record<HunterDangerKind, KidQuizFallback>> = {
  blind_corner: {
    question: "見通しの わるい 角では どうする？",
    choices: [
      "いちど 止まって 顔を 出して 見る",
      "そのまま 走って ぬける",
      "車は 来ないと 決めて すすむ",
      "スマホを 見ながら あるく",
    ],
    explanation: "止まれば 曲がってくる 車に 気づけるよ。",
  },
  popout_spot: {
    question: "車の かげの そばを とおるときは？",
    choices: [
      "ゆっくり あるいて、出てこないか 見る",
      "いきおいよく 走って ぬける",
      "目を つぶって すすむ",
      "音だけで すすむ",
    ],
    explanation: "かげから 人や 車が 出てくるかも。",
  },
  crossing_no_signal: {
    question: "信号の ない 道を わたるときは どうする？",
    choices: [
      "止まって 左右を よく 見てから わたる",
      "車の 音が しなければ わたる",
      "手を あげれば 車は 止まる",
      "走って いそいで わたる",
    ],
    explanation: "止まって 見れば 車に すぐ 気づけるよ。",
  },
  turning_car: {
    question: "曲がってくる 車の そばでは どうする？",
    choices: [
      "車と 目を 合わせて、待ってから わたる",
      "そのまま 車の 前を わたる",
      "車は 止まると 決めつける",
      "走って わたる",
    ],
    explanation: "曲がってくる 車から きみが 見えにくいよ。",
  },
  narrow_sidewalk: {
    question: "道を あるくときは どこを あるく？",
    choices: [
      "歩道や 道の はしを あるく",
      "車道の 真ん中を あるく",
      "スマホを 見ながら あるく",
      "ともだちと 走りまわる",
    ],
    explanation: "車から はなれて あるくと あんしんだよ。",
  },
  parked_car_shadow: {
    question: "止まっている 車の そばを とおるときは？",
    choices: [
      "ゆっくり 歩いて 気をつける",
      "車の かげを 走って ぬける",
      "かげは あんぜんと 決めつける",
      "スマホを 見ながら とおる",
    ],
    explanation: "止まっている 車の かげは 見えにくいよ。",
  },
  falling_object: {
    question: "上から 物が 落ちてきそうな ところでは どうする？",
    choices: [
      "上を 見て、はなれて 歩く",
      "気にせず そのまま 歩く",
      "いそいで 下を 走りぬける",
      "立ち止まって 上だけ 見続ける",
    ],
    explanation: "上から 落ちてくる ものが あるかも。",
  },
  flood_dip: {
    question: "水が たまりやすい 道では どうする？",
    choices: [
      "水たまりは よけて 歩く",
      "水たまりに 入って 歩く",
      "気にせず まっすぐ 歩く",
      "走って 水を はねとばす",
    ],
    explanation: "雨の 日は 水が たまりやすいよ。",
  },
  other: {
    question: "ここでは どう 気をつける？",
    choices: [
      "まわりを よく 見て、ゆっくり 歩く",
      "気にせず 走る",
      "スマホを 見ながら 歩く",
      "そこらじゅうを はしりまわる",
    ],
    explanation: "ここは ちょっと 気をつけて みてね。",
  },
}

/** kind -> 歩行児童への事故リスクに基づく既定 severity。 */
export const SEVERITY_BY_KIND: Readonly<Record<HunterDangerKind, RiskSeverity>> = {
  blind_corner: "high",
  popout_spot: "high",
  crossing_no_signal: "high",
  turning_car: "high",
  parked_car_shadow: "medium",
  narrow_sidewalk: "medium",
  falling_object: "medium",
  flood_dip: "low",
  other: "low",
}

/**
 * 警察庁の事故類型ラベル(例「出会い頭」「人対車両横断中」)を、
 * 写真内で優先的に同定すべき危険 kind へ対応づける。未知は null。
 * accidentLink の補完や、ガイドモードのクイズ選択に使う。
 */
const ACCIDENT_TYPE_TO_KIND: ReadonlyArray<readonly [string, HunterDangerKind]> = [
  ["出会い頭", "blind_corner"],
  ["出合い頭", "blind_corner"],
  ["横断中", "crossing_no_signal"],
  ["横断", "crossing_no_signal"],
  ["飛び出", "popout_spot"],
  ["とびだし", "popout_spot"],
  ["右折", "turning_car"],
  ["左折", "turning_car"],
  ["進路変更", "turning_car"],
  ["駐車車両", "parked_car_shadow"],
  ["追突", "parked_car_shadow"],
  ["転落", "falling_object"],
  ["工作物", "falling_object"],
]

export function accidentTypeToKind(raw: string | null | undefined): HunterDangerKind | null {
  if (!raw) return null
  const hit = ACCIDENT_TYPE_TO_KIND.find(([key]) => raw.includes(key))
  return hit ? hit[1] : null
}
