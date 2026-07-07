import type { DangerReport } from "@/lib/types"

export interface KidsHazardCue {
  shortMessage: string
  action: string
  dangerKind: string
}

const APPROACH_DISTANCE_METERS = 50

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function normalizeText(report: DangerReport): string {
  return `${report.title ?? ""} ${report.description ?? ""} ${report.danger_type ?? ""}`.toLowerCase()
}

export function isApproachingHazard(distanceMeters: number): boolean {
  return Number.isFinite(distanceMeters) && distanceMeters <= APPROACH_DISTANCE_METERS
}

const CRIME_CUE: KidsHazardCue = {
  shortMessage: "こまったら、大人がいる明るい場所へ行こう",
  action: "逃げこめるお店や家を親子で見つけよう",
  dangerKind: "防犯",
}

const CONSTRUCTION_CUE: KidsHazardCue = {
  shortMessage: "こうじで あるく ばしょが かわっているよ",
  action: "くるまみちに はみださないで、ゆっくり あるこう",
  dangerKind: "こうじ",
}

const DISASTER_CUE: KidsHazardCue = {
  shortMessage: "いつもとちがう日は、むりに通らないようにしよう",
  action: "安全に戻れる道を親子で確認しよう",
  dangerKind: "災害",
}

const TRAFFIC_CUE: KidsHazardCue = {
  shortMessage: "ここでは止まって、みぎ・ひだりを見よう",
  action: "車が止まったことを見てからわたろう",
  dangerKind: "交通",
}

const SIDEWALK_CUE: KidsHazardCue = {
  shortMessage: "歩道がせまいから、車道に近づきすぎないようにしよう",
  action: "車道からはなれて歩こう",
  dangerKind: "歩道",
}

const RAIN_CUE: KidsHazardCue = {
  shortMessage: "雨の日はすべりやすいから、ゆっくり歩こう",
  action: "足もとを見て、走らずに進もう",
  dangerKind: "雨の日",
}

const DEFAULT_CUE: KidsHazardCue = {
  shortMessage: "ここでは立ち止まって、まわりをよく見よう",
  action: "どこで待つと安全か親子で確認しよう",
  dangerKind: "注意",
}

/** 報告者が選んだ具体的な危険タイプ → 子ども向けキュー。 */
const TYPE_CUE: Record<string, KidsHazardCue> = {
  crime: CRIME_CUE,
  // 不審者アラート(danger_type='suspicious')は防犯として扱う。
  // これが無いと本文に「不審」等のキーワードが無いとき汎用文言に落ち、
  // 危険度の高い不審者情報に防犯助言が出なくなる。
  suspicious: CRIME_CUE,
  construction: CONSTRUCTION_CUE,
  disaster: DISASTER_CUE,
  traffic: TRAFFIC_CUE,
}

export function createKidsHazardCue(report: DangerReport): KidsHazardCue {
  const dangerType = report.danger_type

  // danger_type が具体的な値を持つ場合は、型を最優先で判定する。
  // 本文(タイトル・説明)に「歩道」「雨」等が偶然含まれていても、型と
  // 矛盾する助言を出さないため(例: disaster の報告メモに「歩道ふさがり」と
  // あっても、倒壊の危険に対して「歩道がせまいから車道へ寄るな」とは言わない)。
  if (dangerType && dangerType in TYPE_CUE) {
    return TYPE_CUE[dangerType]
  }

  // danger_type が other / 未設定のときだけ、本文キーワードで推定する。
  const sourceText = normalizeText(report)

  if (includesAny(sourceText, ["歩道", "せま", "狭", "自転車"])) {
    return SIDEWALK_CUE
  }
  if (includesAny(sourceText, ["雨", "水たまり", "すべ", "滑"])) {
    return RAIN_CUE
  }
  if (includesAny(sourceText, ["不審", "暗", "人目", "死角"])) {
    return CRIME_CUE
  }
  if (includesAny(sourceText, ["工事", "こうじ"])) {
    return CONSTRUCTION_CUE
  }
  if (includesAny(sourceText, ["災害", "避難", "川", "水"])) {
    return DISASTER_CUE
  }
  if (includesAny(sourceText, ["交差点", "車", "見通し", "横断"])) {
    return TRAFFIC_CUE
  }

  return DEFAULT_CUE
}
