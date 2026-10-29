"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Search, UserX, ChevronRight } from "lucide-react"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

interface ReportBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** このシートから行ける先。先読み(prefetch)と遷移(push)で同じ値を使う。 */
const HUNTER_PATH = "/safety-quest/hunter"
const SUSPICIOUS_ALERT_MAP_PATH = "/map?suspiciousAlert=1"

export function ReportBottomSheet({ open, onOpenChange }: ReportBottomSheetProps) {
  const router = useRouter()

  // シートが開いたら、両方の行き先を先に読み込んでおく。
  // きけんハンターはログイン確認つきの動的ページで、本番では専用の Worker が担当する。
  // 押してから取りに行くと、起動を待つ数秒間いまの画面のまま何も起きないように見える。
  // 待ち画面(app/safety-quest/hunter/loading.tsx)まで先読みしておけば、押した直後に切り替わる。
  useEffect(() => {
    if (!open) return
    router.prefetch(HUNTER_PATH)
    router.prefetch(SUSPICIOUS_ALERT_MAP_PATH)
  }, [open, router])

  const handleHunter = () => {
    onOpenChange(false)
    router.push(HUNTER_PATH)
  }

  const handleSuspiciousAlert = () => {
    onOpenChange(false)
    router.push(SUSPICIOUS_ALERT_MAP_PATH)
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
              <Search className="h-5 w-5" style={{ color: C.ink }} strokeWidth={2.8} />
            </div>
            <div>
              <SheetTitle className="text-[17px] font-black" style={{ color: C.ink }}>
                きけんハンター
              </SheetTitle>
              <SheetDescription className="text-[12.5px] font-bold" style={{ color: C.inkSoft }}>
                写真にかくれた危険をさがして、気をつける練習をしよう
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-2.5" style={{ wordBreak: "keep-all" }}>
          <button
            type="button"
            onClick={handleHunter}
            className={`chunky-press flex min-h-[68px] items-center gap-3.5 rounded-[20px] border-2 bg-white px-4 py-3 text-left ${tankenTokens.cls.focus}`}
            style={{ borderColor: "rgba(21,158,114,.3)", boxShadow: tankenTokens.shadow.pressPaper }}
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]"
              style={{ background: C.primarySoft }}
            >
              <Search className="h-5 w-5" style={{ color: C.primaryStrong }} strokeWidth={2.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-black" style={{ color: C.ink }}>きけんハンターを はじめる</p>
              <p className="text-[12px] font-bold" style={{ color: C.inkSoft }}>しゃしんを えらんで、きけんを さがそう</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.inkSoft }} />
          </button>

          <button
            type="button"
            onClick={handleSuspiciousAlert}
            className={`chunky-press flex min-h-[68px] items-center gap-3.5 rounded-[20px] border-2 bg-white px-4 py-3 text-left ${tankenTokens.cls.focus}`}
            style={{ borderColor: "rgba(244,128,31,.35)", boxShadow: tankenTokens.shadow.pressPaper }}
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]"
              style={{ background: C.accentSoft }}
            >
              <UserX className="h-5 w-5" style={{ color: C.accentStrong }} strokeWidth={2.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-black" style={{ color: C.ink }}>不審者アラートを地図化</p>
              <p className="text-[12px] font-bold" style={{ color: C.inkSoft }}>学校からの不審者情報を地図ですぐ共有</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.inkSoft }} />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
