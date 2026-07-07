"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HelpCircle } from "lucide-react"

import AppOnboarding from "@/components/onboarding/app-onboarding"
import { Button } from "@/components/ui/button"
import { tankenTokens } from "@/lib/design/tanken"

const MapContainer = dynamic(() => import("@/components/map/map-container"), {
  ssr: false,
  loading: () => (
    <div className="fullscreen-map-container">
      <div className="relative h-full min-h-[500px] w-full bg-slate-100" />
    </div>
  ),
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

      <div className="fixed left-3 z-40 bottom-[calc(env(safe-area-inset-bottom,0px)+11rem)] md:left-auto md:bottom-4 md:right-4">
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
