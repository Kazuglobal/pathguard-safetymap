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
  return type in BASE_CONTENT ? (type as keyof typeof BASE_CONTENT) : "other"
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

  return {
    summary: template.summary,
    checkpoints: template.checkpoints,
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
