"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HelpCircle } from "lucide-react"

import MapContainer from "@/components/map/map-container"
import UsageTutorialDialog from "@/components/map/usage-tutorial-dialog"
import { Button } from "@/components/ui/button"
import { shouldShowTutorial } from "@/lib/tutorial-storage"

export default function MapPageClient() {
  const [showTutorial, setShowTutorial] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoOpenReport = searchParams.get("report") === "open"
  const preferredRouteId = searchParams.get("routeId")

  useEffect(() => {
    if (shouldShowTutorial()) {
      const timer = setTimeout(() => {
        setShowTutorial(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

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
      />

      <div className="fixed left-3 z-40 bottom-[calc(env(safe-area-inset-bottom,0px)+11rem)] md:left-auto md:bottom-4 md:right-4">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-sky-200 bg-white/95 shadow-lg backdrop-blur-sm h-10 w-10 p-0 md:h-auto md:w-auto md:px-4"
          onClick={() => setShowTutorial(true)}
          aria-label="使い方を確認"
        >
          <HelpCircle className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">使い方</span>
        </Button>
      </div>

      <UsageTutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
      />
    </>
  )
}
