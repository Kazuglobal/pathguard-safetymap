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

export function createKidsHazardCue(report: DangerReport): KidsHazardCue {
  const sourceText = normalizeText(report)
  const dangerType = report.danger_type

  if (includesAny(sourceText, ["歩道", "せま", "狭", "自転車"])) {
    return {
      shortMessage: "歩道がせまいから、車道に近づきすぎないようにしよう",
      action: "車道からはなれて歩こう",
      dangerKind: "歩道",
    }
  }

  if (includesAny(sourceText, ["雨", "水たまり", "すべ", "滑"])) {
    return {
      shortMessage: "雨の日はすべりやすいから、ゆっくり歩こう",
      action: "足もとを見て、走らずに進もう",
      dangerKind: "雨の日",
    }
  }

  if (dangerType === "crime" || includesAny(sourceText, ["不審", "暗", "人目", "死角"])) {
    return {
      shortMessage: "こまったら、大人がいる明るい場所へ行こう",
      action: "逃げこめるお店や家を親子で見つけよう",
      dangerKind: "防犯",
    }
  }

  if (dangerType === "disaster" || includesAny(sourceText, ["災害", "避難", "川", "水"])) {
    return {
      shortMessage: "いつもとちがう日は、むりに通らないようにしよう",
      action: "安全に戻れる道を親子で確認しよう",
      dangerKind: "災害",
    }
  }

  if (dangerType === "traffic" || includesAny(sourceText, ["交差点", "車", "見通し", "横断"])) {
    return {
      shortMessage: "ここでは止まって、みぎ・ひだりを見よう",
      action: "車が止まったことを見てからわたろう",
      dangerKind: "交通",
    }
  }

  return {
    shortMessage: "ここでは立ち止まって、まわりをよく見よう",
    action: "どこで待つと安全か親子で確認しよう",
    dangerKind: "注意",
  }
}
