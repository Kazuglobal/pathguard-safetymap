"use client"

import Link from "next/link"
import { BarChart3, ChevronRight, Newspaper, Route, Search, User, type LucideIcon } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/** 地図画面のスマホでは下部タブバーを出さない（lib/navigation-visibility.ts）ので、他の画面へはここから移る。 */
const MAP_MENU_LINKS: ReadonlyArray<{ href: string; label: string; description: string; icon: LucideIcon }> = [
  { href: "/landing", label: "ホーム", description: "ヒヤリハット・ニュース", icon: Newspaper },
  { href: "/safety-quest/hunter", label: "きけんハンター", description: "写真で危険をさがす練習", icon: Search },
  { href: "/routes", label: "通学路", description: "通学路を登録・確認", icon: Route },
  { href: "/mypage", label: "活動", description: "プロフィール・ミッション・設定", icon: User },
  { href: "/report", label: "報告一覧", description: "みんなの危険報告", icon: BarChart3 },
]

interface MapMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MapMenuSheet({ open, onOpenChange }: MapMenuSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[26px] border-t pb-safe paper-surface"
        style={{ borderColor: "rgba(67,57,43,.12)" }}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-black" style={{ color: C.ink }}>メニュー</SheetTitle>
          <SheetDescription style={{ color: C.inkSoft }}>ほかの画面へ移動します</SheetDescription>
        </SheetHeader>
        <nav aria-label="ほかの画面" className="mt-3 grid gap-2 pb-2">
          {MAP_MENU_LINKS.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              onClick={() => onOpenChange(false)}
              className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 ${tankenTokens.cls.focus}`}
              style={{ borderColor: "rgba(67,57,43,.12)" }}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color: C.primaryStrong }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black" style={{ color: C.ink }}>{label}</span>
                <span className="block text-xs font-bold" style={{ color: C.inkSoft }} aria-hidden="true">{description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.inkFaint }} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
