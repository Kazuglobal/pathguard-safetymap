import {
  Car,
  Shield,
  AlertTriangle,
  HelpCircle,
  UserX,
  type LucideIcon,
} from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { getDangerLevelPresentation, formatDangerLevelBadgeText } from "@/lib/report-generation/danger-level-presentation"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"

/** Danger type label mapping */
export function getDangerTypeLabel(type: string): string {
  switch (type) {
    case "traffic":
      return "交通危険"
    case "crime":
      return "犯罪危険"
    case "disaster":
      return "災害危険"
    case "suspicious":
      return "不審者情報"
    case "other":
      return "その他"
    default:
      return type
  }
}

/** Danger type icon mapping */
export function getDangerTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "traffic":
      return Car
    case "crime":
      return Shield
    case "disaster":
      return AlertTriangle
    case "suspicious":
      return UserX
    case "other":
      return HelpCircle
    default:
      return HelpCircle
  }
}

/**
 * Danger level color configuration
 * danger-level-presentation.ts の一元定義に委譲(表示は1〜4にクランプ)。
 * 独自の色分岐を復活させないこと。
 */
export function getDangerLevelColor(level: number): {
  bg: string
  text: string
  border: string
  band: string
  badgeClass: string
} {
  const presentation = getDangerLevelPresentation(level)
  return {
    ...presentation.surface,
    badgeClass: presentation.badgeClass,
  }
}

/** Danger level label(★段階+子ども向けラベル。一元定義に委譲) */
export function getDangerLevelLabel(level: number): string {
  return formatDangerLevelBadgeText(level)
}

/** Parse unknown value to coordinate number */
export function toCoordinateNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Add cache-busting parameter to image URL */
export function addCacheBuster(url: string | null, token: number = Date.now()): string | null {
  if (!url) return null
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}t=${token}`
}

/** Format address from report fields */
export function formatAddress(report: DangerReport): string | null {
  const parts = [report.prefecture, report.city, report.town].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join("")
}

/** Format postal code for display */
export function formatPostalCode(code: string | null): string | null {
  if (!code) return null
  const cleaned = code.replace(/[^0-9]/g, "")
  if (cleaned.length === 7) {
    return `〒${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  }
  return `〒${code}`
}

/** Format coordinates for human-readable display */
export function formatCoordinates(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`
}

/**
 * 報告の公開状態の表示定義。
 *
 * status(公開状態: pending/approved/resolved)と
 * ai_moderation_status(AI一次審査: approved/needs_review/rejected)を
 * 組み合わせて投稿者に実際の状態を伝える。
 *
 * 背景: かつて approved 以外を一律「審査中」と表示していたため、
 * AI審査で rejected(非公開確定)になっても投稿者には永遠に
 * 「審査中」に見えていた。結果が伝わらない2値表示に戻さないこと。
 *
 * 注意: pending の報告はRLSにより投稿者本人(と管理者)にしか届かないため、
 * moderationNote(審査理由)がここで公開側に漏れることはない。
 */
export interface ReportStatusPresentation {
  label: string
  badgeClass: string
  /** 投稿者向けの補足(AI審査の理由)。表示すべきものが無ければ null */
  moderationNote: string | null
}

/** 公開ステータスごとの表示ラベル。公開判定そのものは PUBLIC_DANGER_REPORT_STATUSES を正とする */
const PUBLIC_STATUS_LABELS: Record<string, string> = {
  approved: "承認済み",
  published: "公開中",
  resolved: "解決済み",
}

export function getReportStatusPresentation(
  report: Pick<DangerReport, "status" | "ai_moderation_status" | "ai_moderation_reason">,
): ReportStatusPresentation {
  // 公開状態の判定は必ず PUBLIC_DANGER_REPORT_STATUSES を経由する。
  // "approved" のハードコード比較だけにすると、標準投稿経路の "published" が
  // 「審査中」誤表示になり、AI審査理由が公開画面に漏れる分岐へ落ちる。
  if ((PUBLIC_DANGER_REPORT_STATUSES as readonly string[]).includes(report.status)) {
    if (report.status === "resolved") {
      return {
        label: "解決済み",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
        moderationNote: null,
      }
    }
    return {
      label: PUBLIC_STATUS_LABELS[report.status] ?? "公開中",
      badgeClass: "bg-green-100 text-green-800 border-green-200",
      moderationNote: null,
    }
  }
  // 管理者による却下(status="rejected")。理由の記録がないため moderationNote は出さない
  if (report.status === "rejected") {
    return {
      label: "非公開(承認されませんでした)",
      badgeClass: "bg-red-100 text-red-800 border-red-200",
      moderationNote: null,
    }
  }
  if (report.ai_moderation_status === "rejected") {
    return {
      label: "非公開(承認されませんでした)",
      badgeClass: "bg-red-100 text-red-800 border-red-200",
      moderationNote: report.ai_moderation_reason ?? null,
    }
  }
  if (report.ai_moderation_status === "needs_review") {
    return {
      label: "審査中(確認が必要です)",
      badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
      moderationNote: report.ai_moderation_reason ?? null,
    }
  }
  return {
    label: "審査中",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    moderationNote: null,
  }
}

/**
 * 投稿者から見て「結果待ち(審査中)」の報告か。ダッシュボード等の件数集計用。
 * 判定は getReportStatusPresentation に委譲し、ステータス文字列の
 * ローカル比較(["pending","reviewing"].includes 等)を各画面に増やさない。
 */
export function isReportUnderReview(
  report: Pick<DangerReport, "status" | "ai_moderation_status" | "ai_moderation_reason">,
): boolean {
  return getReportStatusPresentation(report).label.startsWith("審査中")
}
