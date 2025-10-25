"use client"

import { useState, useEffect } from "react"
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
      
      {/* ヘルプボタンは削除（ヘッダーに統合済み） */}

      {/* 利用方法ポップアップ */}
      <UsageTutorialDialog 
        open={showTutorial} 
        onOpenChange={setShowTutorial} 
      />
    </>
  )
} 
