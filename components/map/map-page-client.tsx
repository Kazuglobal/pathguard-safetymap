"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"
import MapContainer from "@/components/map/map-container"
import UsageTutorialDialog from "@/components/map/usage-tutorial-dialog"

export default function MapPageClient() {
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    // 初回訪問かチェック
    const hasSeenTutorial = localStorage.getItem('pathguard-tutorial-completed')
    if (!hasSeenTutorial) {
      // 少し遅延させてから表示
      const timer = setTimeout(() => {
        setShowTutorial(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <>
      {/* マップコンテナ */}
      <MapContainer />
      
      {/* ヘルプボタン */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowTutorial(true)}
          size="lg"
          className="bg-sky-600 hover:bg-sky-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <HelpCircle className="w-5 h-5 mr-2" />
          使い方
        </Button>
      </div>

      {/* 利用方法ポップアップ */}
      <UsageTutorialDialog 
        open={showTutorial} 
        onOpenChange={setShowTutorial} 
      />
    </>
  )
} 