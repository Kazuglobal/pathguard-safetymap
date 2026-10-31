"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { ChevronRight, Flag, Search, UserX } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { REPORT_ENTRY_LABEL, REPORT_PATH, REPORT_SHEET_TITLE } from "@/lib/report-entry"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

interface ReportBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// このシートから行ける先。先読み(prefetch)と遷移(push)で同じ値を使う。
const SUSPICIOUS_ALERT_MAP_PATH = "/map?suspiciousAlert=1"
const HUNTER_PATH = "/safety-quest/hunter"

interface SheetAction {
  key: string
  href: string
  title: string
  description: string
  icon: LucideIcon
  iconColor: string
  iconBackground: string
  borderColor: string
}

const ACTIONS: readonly SheetAction[] = [
  {
    key: "report",
    href: REPORT_PATH,
    title: REPORT_ENTRY_LABEL,
    description: "気づいた危険を、地図で場所を選んで知らせる",
    icon: Flag,
    iconColor: C.primaryStrong,
    iconBackground: C.primarySoft,
    borderColor: "rgba(21,158,114,.3)",
  },
  {
    key: "suspicious-alert",
    href: SUSPICIOUS_ALERT_MAP_PATH,
    title: "不審者アラートを地図化",
    description: "学校からの不審者情報を地図ですぐ共有",
    icon: UserX,
    iconColor: C.accentStrong,
    iconBackground: C.accentSoft,
    borderColor: "rgba(244,128,31,.35)",
  },
  {
    key: "hunter",
    href: HUNTER_PATH,
    title: "きけんハンターを はじめる",
    description: "しゃしんを えらんで、きけんを さがそう",
    icon: Search,
    iconColor: C.ink,
    iconBackground: C.sunSoft,
    borderColor: "rgba(226,168,18,.45)",
  },
]

export function ReportBottomSheet({ open, onOpenChange }: ReportBottomSheetProps) {
  const router = useRouter()

  // シートが開いたら、行き先を先に読み込んでおく。
  // きけんハンターはログイン確認つきの動的ページで、本番では専用の Worker が担当する。
  // 押してから取りに行くと、起動を待つ数秒間いまの画面のまま何も起きないように見える。
  // 待ち画面(app/safety-quest/hunter/loading.tsx)まで先読みしておけば、押した直後に切り替わる。
  useEffect(() => {
    if (!open) return
    for (const action of ACTIONS) router.prefetch(action.href)
  }, [open, router])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[26px] border-t pb-safe paper-surface"
        style={{
          borderColor: "rgba(67,57,43,.12)",
          fontFamily: tankenTokens.font.family,
        }}
      >
        <SheetHeader className="mb-5 text-left">
          <div className="flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-full border-2"
              style={{ background: C.sun, borderColor: "rgba(67,57,43,.22)", boxShadow: tankenTokens.shadow.pressSun }}
            >
              <Flag className="h-5 w-5" style={{ color: C.ink }} strokeWidth={2.8} aria-hidden="true" />
            </div>
            <div>
              <SheetTitle className="text-[17px] font-black" style={{ color: C.ink }}>
                {REPORT_SHEET_TITLE}
              </SheetTitle>
              <SheetDescription className="text-[12.5px] font-bold" style={{ color: C.inkSoft }}>
                気づいた危険を知らせたり、写真で危険をさがしたりできます
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-2.5" style={{ wordBreak: "keep-all" }}>
          {ACTIONS.map(({ key, href, title, description, icon: Icon, iconColor, iconBackground, borderColor }) => (
            <button
              key={key}
              type="button"
              onClick={() => go(href)}
              className={`chunky-press flex min-h-[68px] items-center gap-3.5 rounded-[20px] border-2 bg-white px-4 py-3 text-left ${tankenTokens.cls.focus}`}
              style={{ borderColor, boxShadow: tankenTokens.shadow.pressPaper }}
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]" style={{ background: iconBackground }}>
                <Icon className="h-5 w-5" style={{ color: iconColor }} strokeWidth={2.6} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-black" style={{ color: C.ink }}>{title}</p>
                <p className="text-[12px] font-bold" style={{ color: C.inkSoft }}>{description}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.inkSoft }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
