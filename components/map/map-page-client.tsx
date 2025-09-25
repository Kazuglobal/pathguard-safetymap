"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, X } from "lucide-react"
import MapContainer from "@/components/map/map-container"
import UsageTutorialDialog from "@/components/map/usage-tutorial-dialog"
import { useIsMobile } from "@/hooks/use-mobile"

export default function MapPageClient() {
  const isMobile = useIsMobile()
  const [showTutorial, setShowTutorial] = useState(false)
  const [showHelpButton, setShowHelpButton] = useState(true)
  const manualHelpToggleRef = useRef(false)

  useEffect(() => {
    if (typeof isMobile !== "boolean") return
    if (!manualHelpToggleRef.current) {
      setShowHelpButton(!isMobile)
    }
  }, [isMobile])

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
      
      {/* ヘルプボタン / トグル */}
      <div className="fixed right-4 top-24 z-50 flex flex-col items-end space-y-2 sm:top-auto sm:right-6 sm:bottom-24 md:bottom-6">
        {isMobile ? (
          <Button
            onClick={() => {
              manualHelpToggleRef.current = true
              setShowHelpButton((prev) => {
                const next = !prev
                if (!prev) {
                  setShowTutorial(true)
                }
                return next
              })
            }}
            size="sm"
            className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-lg transition-all duration-200 ${showHelpButton ? 'bg-white text-sky-600 hover:bg-gray-100' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
            aria-label={showHelpButton ? "使い方を閉じる" : "使い方を見る"}
          >
            {showHelpButton ? (
              <>
                <X className="h-4 w-4" />
                <span>閉じる</span>
              </>
            ) : (
              <>
                <HelpCircle className="h-4 w-4" />
                <span>使い方</span>
              </>
            )}
          </Button>
        ) : showHelpButton ? (
          <div className="relative group">
            <Button
              onClick={() => {
                manualHelpToggleRef.current = true
                setShowHelpButton(true)
                setShowTutorial(true)
              }}
              size="default"
              className="bg-sky-600 hover:bg-sky-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <HelpCircle className="w-5 h-5 mr-2" />
              使い方
            </Button>
            <button
              onClick={() => {
                manualHelpToggleRef.current = true
                setShowHelpButton(false)
              }}
              className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-0.5 text-gray-500 hover:text-gray-700 shadow group-hover:opacity-100 opacity-0 transition-opacity duration-200"
              aria-label="ヘルプを隠す"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <Button
            onClick={() => {
              manualHelpToggleRef.current = true
              setShowHelpButton(true)
            }}
            size="icon"
            variant="outline"
            className="bg-white hover:bg-gray-50 shadow"
            aria-label="ヘルプを表示"
          >
            <HelpCircle className="w-5 h-5 text-sky-600" />
          </Button>
        )}
      </div>

      {/* 利用方法ポップアップ */}
      <UsageTutorialDialog 
        open={showTutorial} 
        onOpenChange={setShowTutorial} 
      />
    </>
  )
} 
