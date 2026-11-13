"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HelpCircle } from "lucide-react"

import AppOnboarding from "@/components/onboarding/app-onboarding"
import HelpDialog from "@/components/map/help-dialog"
import SpotGuide, { type SpotGuideCloseReason } from "@/components/map/spot-guide"
import { MAP_GUIDE_STEPS } from "@/lib/spot-guide-steps"
import { markSpotGuideSeen, shouldShowSpotGuide } from "@/lib/spot-guide-storage"
import { Button } from "@/components/ui/button"
import { tankenTokens } from "@/lib/design/tanken"
// 地図を開いた直後(app/map/loading.tsx)と同じ待ち表示
import { MapLoadingPlaceholder } from "@/components/map/map-loading-placeholder"

const MapContainer = dynamic(() => import("@/components/map/map-container"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
})

/** 地図の部品が出そろうのを待つ間隔と回数(20秒まで) */
const MAP_GUIDE_POLL_MS = 500
const MAP_GUIDE_MAX_TRIES = 40

export default function MapPageClient() {
  const [showTutorial, setShowTutorial] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoOpenReport = searchParams.get("report") === "open"
  const preferredRouteId = searchParams.get("routeId")
  const initialReportId = searchParams.get("reportId")
  const [showSpotGuide, setShowSpotGuide] = useState(false)
  // 報告や特定の報告を開く用事で来たときは、案内で先をふさがない(つぎに地図を開いたときに出す)
  const arrivedWithTaskRef = useRef(autoOpenReport || Boolean(initialReportId))

  // はじめて地図を開いたとき、実際のボタンを1つずつ照らして場所を案内する。
  // 地図の部品が出そろい、ほかのダイアログが開いていないのを待ってから出す
  useEffect(() => {
    if (arrivedWithTaskRef.current || !shouldShowSpotGuide("map")) return

    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      const isReady = document.querySelector('[data-guide="map-search"]') !== null
      const isBusy = document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
      if (isReady && !isBusy) {
        window.clearInterval(timer)
        setShowSpotGuide(true)
      } else if (tries >= MAP_GUIDE_MAX_TRIES) {
        window.clearInterval(timer)
      }
    }, MAP_GUIDE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const handleSpotGuideClose = (reason: SpotGuideCloseReason) => {
    setShowSpotGuide(false)
    // 照らせる部品が1つも無かったときは、見たことにしない
    if (reason !== "empty") markSpotGuideSeen("map")
  }

  // 初回表示は AppOnboardingGate(layout-provider)が担当。
  // ここでは右下の「使い方」ボタンからの再生のみ扱う。

  useEffect(() => {
    if (!autoOpenReport) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("report")
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    router.replace(nextUrl, { scroll: false })
  }, [autoOpenReport, pathname, router, searchParams])

  return (
    <>
      <MapContainer
        autoOpenReport={autoOpenReport}
        preferredRouteId={preferredRouteId}
        initialReportId={initialReportId}
      />

      <div data-guide="map-help" className="map-help-fab fixed left-3 z-40 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:left-auto md:bottom-4 md:right-4">
        <Button
          type="button"
          variant="outline"
          className={`h-10 w-10 rounded-full border p-0 font-black md:h-auto md:w-auto md:px-4 ${tankenTokens.cls.focus}`}
          style={{
            background: "rgba(255,253,247,.95)",
            borderColor: "rgba(67,57,43,.12)",
            color: tankenTokens.color.inkSoft,
            boxShadow: tankenTokens.shadow.float,
            backdropFilter: "blur(10px)",
          }}
          // 「使い方」は地図のヘルプ。はじめての案内(絵本のガイド)は、ヘルプの中から別に開く(UIUX改装 項目51)
          onClick={() => setShowHelp(true)}
          aria-label="使い方を確認"
        >
          <HelpCircle className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">使い方</span>
        </Button>
      </div>

      <HelpDialog
        open={showHelp}
        onOpenChange={setShowHelp}
        onReplayOnboarding={() => setShowTutorial(true)}
        onReplaySpotGuide={() => setShowSpotGuide(true)}
      />

      <SpotGuide
        open={showSpotGuide && !showTutorial}
        steps={MAP_GUIDE_STEPS}
        label="地図の画面の案内"
        onClose={handleSpotGuideClose}
      />

      <AppOnboarding
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </>
  )
}
