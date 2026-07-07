import type { ARHazardData } from "@/lib/ar-utils"
import type { DangerReport } from "@/lib/types"

export type ARLearningTourStatus = "pending" | "reviewed" | "saved"

export interface ARLearningContent {
  summary: string
  checkpoints: string[]
  attentionTags: string[]
}

export interface ARLearningTourStop {
  hazard: ARHazardData
  report: DangerReport
  content: ARLearningContent
  status: ARLearningTourStatus
}

export interface ARLearningTourSummary {
  totalCount: number
  reviewedCount: number
  savedCount: number
  revisitStops: ARLearningTourStop[]
  highestRiskStop: ARLearningTourStop | null
}

const BASE_CONTENT: Record<string, Omit<ARLearningContent, "attentionTags">> = {
  traffic: {
    summary: "交差点に入る車や自転車の動きを先に確認し、子どもが止まる位置を具体的に見ておく場所です。",
    checkpoints: ["子どもの目線で見通しを確認する", "横断前に車の動線を確認する"],
  },
  construction: {
    summary: "工事や仮設物で歩く位置が変わりやすく、通学時の動線がぶれないか確認したい場所です。",
    checkpoints: ["歩道の幅が急に狭くならないか確認する", "迂回時に車道へ寄りすぎない位置を確かめる"],
  },
  crime: {
    summary: "人目が少ない時間帯や死角になりやすい場所かを、保護者視点で見ておきたい地点です。",
    checkpoints: ["逃げ込める場所が近くにあるか確認する", "見守りしにくい死角がないか確かめる"],
  },
  disaster: {
    summary: "天候や災害時に通りにくくなる可能性があり、普段と違う危険が出やすい場所です。",
    checkpoints: ["雨の日に水がたまりそうな場所を確認する", "避難しやすい方向を把握する"],
  },
  other: {
    summary: "周囲の状況を落ち着いて観察し、子どもが迷いやすい要素がないか確認する場所です。",
    checkpoints: ["立ち止まる位置が安全か確認する", "周囲から子どもが見えやすいか確かめる"],
  },
}

function normalizeType(type: string | null | undefined): keyof typeof BASE_CONTENT {
  if (!type) return "other"
  // 不審者アラート(danger_type='suspicious')は防犯テンプレートを使う。
  if (type === "suspicious") return "crime"
  return type in BASE_CONTENT ? (type as keyof typeof BASE_CONTENT) : "other"
}

interface SpecificHint {
  keywords: string[]
  /** 「おうちのかたへ」に足す、その場所固有のひとこと(保護者向け) */
  concern: string
  /** その場所固有の現地確認項目 */
  checkpoint: string
}

/**
 * 報告の本文(タイトル・説明)キーワードから、その場所固有の一言と現地確認項目を導く。
 * これで同じ danger_type でも内容が違えば「おうちのかたへ」が変わり、定型文の
 * 重複感が薄れる。全て安全側の一般的助言に限定し、誤情報や過度な断定は作らない。
 * 優先順は「より具体的・危険度の高い事象」を上に置く(先頭一致を採用)。
 */
const SPECIFIC_HINTS: SpecificHint[] = [
  {
    keywords: ["ブロック", "塀", "へい", "フェンス", "倒壊", "電柱", "落下"],
    concern: "地震などで塀や電柱が倒れてこないか、いっしょに見ておきましょう",
    checkpoint: "倒れてきそうな塀・電柱から離れて歩く",
  },
  {
    keywords: ["川", "用水", "水路", "氾濫", "増水"],
    concern: "増水したときは水辺に近づかないよう、迂回できる道を決めておきましょう",
    checkpoint: "増水時に近づかない迂回路を親子で決める",
  },
  {
    keywords: ["見通し", "みとおし", "カーブ", "曲が"],
    concern: "見通しが悪く車や自転車が急に現れやすいので、止まる位置を決めておきましょう",
    checkpoint: "見通しが悪い地点で一度止まる位置を決める",
  },
  {
    keywords: ["スピード", "速い", "はやい", "飛び出", "とびだ"],
    concern: "車がスピードを出しやすいので、渡る前に止まる習慣をつけましょう",
    checkpoint: "車の速さと、渡る前に止まる位置を確認する",
  },
  {
    keywords: ["暗", "夜", "街灯", "照明", "人通り", "人目", "死角"],
    concern: "暗い時間帯は人通りが少なくなりやすいので、明るい道を選びましょう",
    checkpoint: "暗くなる時間帯の明るさと人通りを確認する",
  },
  {
    keywords: ["雨", "水たまり", "すべ", "滑"],
    concern: "雨の日は足もとが滑りやすいので、走らずゆっくり歩きましょう",
    checkpoint: "雨の日に滑りやすい場所を親子で確認する",
  },
  {
    keywords: ["工事", "こうじ"],
    concern: "工事で歩く場所が変わりやすいので、毎回どこを歩くか確認しましょう",
    checkpoint: "工事で歩く場所が変わっていないか確認する",
  },
]

function deriveSpecificHint(report: DangerReport): SpecificHint | null {
  const sourceText = `${report.title ?? ""} ${report.description ?? ""}`.toLowerCase()
  return (
    SPECIFIC_HINTS.find((hint) =>
      hint.keywords.some((keyword) => sourceText.includes(keyword.toLowerCase()))
    ) ?? null
  )
}

function buildAttentionTags(report: DangerReport): string[] {
  const tags = new Set<string>(["現地確認"])
  const sourceText = `${report.title} ${report.description ?? ""}`.toLowerCase()

  if (report.danger_level >= 4) {
    tags.add("高リスク")
  } else if (report.danger_level <= 2) {
    tags.add("要観察")
  }

  if (sourceText.includes("雨")) {
    tags.add("雨天注意")
  }

  if (sourceText.includes("朝") || sourceText.includes("登校")) {
    tags.add("登校時間帯")
  }

  if (sourceText.includes("見通し")) {
    tags.add("見通し確認")
  }

  return [...tags]
}

export function createARLearningContent(report: DangerReport): ARLearningContent {
  if (report.learning_summary && report.learning_checkpoints?.length) {
    return {
      summary: report.learning_summary,
      checkpoints: report.learning_checkpoints.slice(0, 3),
      attentionTags:
        report.attention_tags?.length ? report.attention_tags : buildAttentionTags(report),
    }
  }

  const template = BASE_CONTENT[normalizeType(report.danger_type)]
  const hint = deriveSpecificHint(report)

  // 本文キーワードに合致すれば、その場所固有の一言・確認項目を差し込む。
  // 同じタイプでも内容が違えば文言が変わり、定型文の重複感が薄れる。
  const summary = hint ? `${template.summary} とくに、${hint.concern}。` : template.summary
  const checkpoints = hint
    ? Array.from(new Set([hint.checkpoint, ...template.checkpoints])).slice(0, 3)
    : template.checkpoints

  return {
    summary,
    checkpoints,
    attentionTags: buildAttentionTags(report),
  }
}

export function buildARLearningTourStops(
  hazards: ARHazardData[],
  progress: Record<string, ARLearningTourStatus> = {}
): ARLearningTourStop[] {
  return hazards.map((hazard) => ({
    hazard,
    report: hazard.report,
    content: createARLearningContent(hazard.report),
    status: progress[hazard.report.id] ?? "pending",
  }))
}

export function summarizeARLearningTour(stops: ARLearningTourStop[]): ARLearningTourSummary {
  const revisitStops = stops.filter((stop) => stop.status === "saved")
  const highestRiskStop =
    stops.reduce<ARLearningTourStop | null>((highest, current) => {
      if (!highest) return current
      return current.report.danger_level > highest.report.danger_level ? current : highest
    }, null) ?? null

  return {
    totalCount: stops.length,
    reviewedCount: stops.filter((stop) => stop.status === "reviewed").length,
    savedCount: revisitStops.length,
    revisitStops,
    highestRiskStop,
  }
}
