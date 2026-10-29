import type { ReactNode } from "react"
import type { DangerReport } from "@/lib/types"
import { tankenTokens } from "@/lib/design/tanken"

const t = tankenTokens

/** マイページが読む自分の報告(一覧・件数・画像コレクションで使う項目だけ) */
export interface MypageReport extends Pick<
  DangerReport,
  "id" | "title" | "created_at" | "status" | "ai_moderation_status" | "ai_moderation_reason" | "image_url" | "processed_image_urls"
> {}

export const mypageCardStyle = {
  background: t.color.card,
  borderColor: t.border.soft,
  boxShadow: t.shadow.card,
  borderRadius: t.radius.card,
} as const

export const mypageInnerPanelStyle = {
  background: t.color.paper,
  borderColor: t.border.faint,
  borderRadius: t.radius.panel,
} as const

/**
 * マイページのグループ(自分の記録・あそぶ・設定。UIUX改装 項目7)。
 * 見出しは h2、グループの中のカードの見出しは h3(CardTitle)。
 */
export function MypageGroup({
  id,
  title,
  eyebrow,
  description,
  children,
}: {
  id: string
  title: string
  /** 見出しの上の小さな文字(あそぶ の「きけんハンター」など) */
  eyebrow?: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold" style={{ color: t.color.primaryStrong }}>
            {eyebrow}
          </p>
        )}
        <h2 id={`${id}-title`} className="text-xl font-black tracking-tight" style={{ color: t.color.ink }}>
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm" style={{ color: t.color.inkSoft }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

export function formatReportDate(value: string | null): string {
  if (!value) return "日時不明"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** 今週の月曜 0時(端末の時刻) */
export function startOfThisWeek(now: Date = new Date()): Date {
  const day = now.getDay() // 0=日
  const diffToMonday = (day + 6) % 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
}
