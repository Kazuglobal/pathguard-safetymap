"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HelpCircle } from "lucide-react"

import AppOnboarding from "@/components/onboarding/app-onboarding"
import { Button } from "@/components/ui/button"
import { tankenTokens } from "@/lib/design/tanken"

/**
 * 地図の部品が届くまでの表示。サーバの HTML に含まれるので、低速の端末でもすぐに出る。
 * 以前は無地のグレーのままで「壊れている」ように見えていた(低速端末で約20秒)。
 */
export function MapLoadingPlaceholder() {
  const t = tankenTokens
  return (
    <div className="fullscreen-map-container">
      <div
        className="relative flex h-full min-h-[500px] w-full items-center justify-center p-4"
        style={{ background: t.color.paperDeep }}
        role="status"
        aria-live="polite"
        data-testid="map-loading-placeholder"
      >
        <div
          className="w-full max-w-sm rounded-[22px] border p-5"
          style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.card }}
        >
          <p className="font-black" style={{ color: t.color.ink }}>
            地図を準備しています
          </p>
          <p className="mt-2 text-sm font-bold" style={{ color: t.color.inkSoft }}>
            地図の部品を読み込んでいます。このあと地図がひらき、危険マーカーがならびます。
          </p>
          <p className="mt-2 text-sm" style={{ color: t.color.inkSoft }}>
            通信が遅いと少し時間がかかります。このままお待ちください。
          </p>
        </div>
      </div>
    </div>
  )
}

const MapContainer = dynamic(() => import("@/components/map/map-container"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
})

export default function MapPageClient() {
  const [showTutorial, setShowTutorial] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoOpenReport = searchParams.get("report") === "open"
  const preferredRouteId = searchParams.get("routeId")
  const initialReportId = searchParams.get("reportId")

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

      <div className="fixed left-3 z-40 bottom-[calc(env(safe-area-inset-bottom,0px)+6.75rem)] md:left-auto md:bottom-4 md:right-4">
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
          onClick={() => setShowTutorial(true)}
          aria-label="使い方を確認"
        >
          <HelpCircle className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">使い方</span>
        </Button>
      </div>

      <AppOnboarding
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </>
  )
}
