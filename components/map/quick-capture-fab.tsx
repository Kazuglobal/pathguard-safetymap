"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, X, Loader2, Share2, MapPin, Upload, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface QuickCaptureFABProps {
  onCaptureComplete: (file: File) => void
  isReportFormOpen: boolean
  isSelectingLocation: boolean
  isMobile: boolean
}

export default function QuickCaptureFAB({
  onCaptureComplete,
  isReportFormOpen,
  isSelectingLocation,
  isMobile,
}: QuickCaptureFABProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    dangerLevel: number
    dangerType: string
    description: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFABClick = useCallback(() => {
    if (isReportFormOpen || isSelectingLocation) return
    fileInputRef.current?.click()
  }, [isReportFormOpen, isSelectingLocation])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Show preview
      const reader = new FileReader()
      reader.onload = () => {
        setCapturedImage(reader.result as string)
        setIsExpanded(true)
      }
      reader.readAsDataURL(file)

      // Simulate AI analysis (actual AI analysis happens in the report form)
      setIsAnalyzing(true)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setAnalysisResult({
        dangerLevel: Math.floor(Math.random() * 3) + 3,
        dangerType: "traffic",
        description: "AI分析完了 - 詳細は報告フォームで確認できます",
      })
      setIsAnalyzing(false)

      // Pass file to parent for report form
      onCaptureComplete(file)

      // Reset input
      e.target.value = ""
    },
    [onCaptureComplete],
  )

  const handleClose = useCallback(() => {
    setIsExpanded(false)
    setCapturedImage(null)
    setAnalysisResult(null)
  }, [])

  const isHidden = isReportFormOpen || isSelectingLocation

  if (isHidden) return null

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* FAB Button */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed z-50"
            style={{
              right: "1rem",
              bottom: isMobile
                ? "calc(env(safe-area-inset-bottom, 0px) + 12rem)"
                : "12rem",
            }}
          >
            <button
              type="button"
              onClick={handleFABClick}
              className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-2xl transition-all hover:scale-110 hover:shadow-orange-500/40 active:scale-95"
              aria-label="写真を撮って危険箇所を報告"
            >
              <Camera className="h-7 w-7" />
              {/* Pulse ring */}
              <span className="absolute inset-0 animate-ping rounded-full bg-orange-400 opacity-20" />
              {/* Label tooltip */}
              <span className="absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                撮影して報告
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Preview Card */}
      <AnimatePresence>
        {isExpanded && capturedImage && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md md:left-auto md:right-4 md:inset-x-auto md:w-96"
          >
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Image preview */}
              <div className="relative aspect-[16/10] w-full">
                <img
                  src={capturedImage}
                  alt="撮影した危険箇所"
                  className="h-full w-full object-cover"
                />
                {/* AI Analysis Overlay */}
                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
                      <Sparkles className="h-5 w-5 animate-pulse text-yellow-300" />
                      <span className="text-sm font-medium text-white">
                        AI分析中...
                      </span>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Result */}
              {analysisResult && !isAnalyzing && (
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-semibold text-slate-900">
                        AI分析結果
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-4 rounded-full ${
                            i < analysisResult.dangerLevel
                              ? "bg-red-500"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-xs font-medium text-slate-600">
                        {analysisResult.dangerLevel}/5
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    {analysisResult.description}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                      onClick={handleClose}
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      マップに投稿
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        fileInputRef.current?.click()
                      }}
                    >
                      <Camera className="mr-1.5 h-4 w-4" />
                      もう1枚
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
