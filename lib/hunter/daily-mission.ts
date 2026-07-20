export type HunterDailyMode = "explore" | "quiz" | "safe"

export interface HunterDailyMission {
  readonly mode: HunterDailyMode
  readonly minutes: 3
  readonly title: string
  readonly detail: string
}

const MISSION_BY_MODE: Record<HunterDailyMode, HunterDailyMission> = {
  explore: {
    mode: "explore",
    minutes: 3,
    title: "「なぜ？」まで 見つけよう",
    detail: "きけんを 1つ 見つけて、つぎに どう動くか 声に 出そう。",
  },
  quiz: {
    mode: "quiz",
    minutes: 3,
    title: "あるきかたを えらぼう",
    detail: "しゃしんを 見て、「とまる・見る・まつ」を えらぼう。",
  },
  safe: {
    mode: "safe",
    minutes: 3,
    title: "まちの まもりを 見つけよう",
    detail: "あんぜんの くふうを 1つ 見つけて、どんな 役目か おぼえよう。",
  },
}

/** ローカル日付を、連続する日番号へ変換する。 */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/**
 * その写真で遊べるモードだけから、日替わりの3分ミッションを選ぶ。
 * 同じ日は同じ内容、翌日は別の内容になり、写真ごとの制約にも従う。
 */
export function pickDailyMission(
  date: Date,
  available: readonly HunterDailyMode[],
): HunterDailyMission | null {
  const unique = [...new Set(available)]
  if (unique.length === 0) return null
  const mode = unique[localDayNumber(date) % unique.length]
  return MISSION_BY_MODE[mode]
}
