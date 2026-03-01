"use client"

import { useState, useEffect } from "react"
import MapContainer from "@/components/map/map-container"
import UsageTutorialDialog from "@/components/map/usage-tutorial-dialog"
import { shouldShowTutorial } from "@/lib/tutorial-storage"

export default function MapPageClient() {
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (shouldShowTutorial()) {
      const timer = setTimeout(() => {
        setShowTutorial(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <MapContainer />

      <UsageTutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
      />
    </>
  )
}
