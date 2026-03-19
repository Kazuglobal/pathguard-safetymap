"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trophy, Share2, Star, ArrowRight, Camera, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import confetti from "canvas-confetti"

interface UploadRewardAnimationProps {
  isVisible: boolean
  pointsEarned: number
  totalPoints: number
  currentLevel: number
  leveledUp: boolean
  newBadge?: string | null
  pointsToNextLevel: number
  onClose: () => void
  onShare: () => void
  onCaptureAnother: () => void
}

export default function UploadRewardAnimation({
  isVisible,
  pointsEarned,
  totalPoints,
  currentLevel,
  leveledUp,
  newBadge,
  pointsToNextLevel,
  onClose,
  onShare,
  onCaptureAnother,
}: UploadRewardAnimationProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [animatedPoints, setAnimatedPoints] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setShowDetails(false)
      setAnimatedPoints(0)
      return
    }

    // Trigger confetti
    const duration = leveledUp ? 3000 : 1500
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: leveledUp ? 4 : 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#3b82f6", "#f59e0b", "#10b981", "#ef4444"],
      })
      confetti({
        particleCount: leveledUp ? 4 : 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#3b82f6", "#f59e0b", "#10b981", "#ef4444"],
      })
      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()

    // Animate points counter
    const step = Math.max(1, Math.floor(pointsEarned / 20))
    let current = 0
    const counterInterval = setInterval(() => {
      current += step
      if (current >= pointsEarned) {
        current = pointsEarned
        clearInterval(counterInterval)
      }
      setAnimatedPoints(current)
    }, 50)

    // Show details after points animation
    const detailTimer = setTimeout(() => setShowDetails(true), 1200)

    return () => {
      clearInterval(counterInterval)
      clearTimeout(detailTimer)
    }
  }, [isVisible, pointsEarned, leveledUp])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.5, y: 50 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="mx-4 w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header gradient */}
          <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 px-6 pb-8 pt-10 text-center text-white">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

            {/* Level up indicator */}
            {leveledUp && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-yellow-400/20 px-4 py-1.5 text-yellow-200 backdrop-blur-sm"
              >
                <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                <span className="text-sm font-bold">レベルアップ!</span>
              </motion.div>
            )}

            {/* Points earned */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2, damping: 15 }}
            >
              <Trophy className="mx-auto mb-2 h-12 w-12 text-yellow-300" />
              <p className="text-lg font-medium text-white/80">ポイント獲得!</p>
              <p className="mt-1 text-5xl font-black tracking-tight">
                +{animatedPoints}
                <span className="text-2xl font-bold">pt</span>
              </p>
            </motion.div>

            {/* Current level */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 flex items-center justify-center gap-3"
            >
              <div className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
                Lv.{currentLevel}
              </div>
              <div className="text-sm text-white/70">
                累計 {totalPoints} pt
              </div>
            </motion.div>
          </div>

          {/* Details section */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4 px-6 py-5"
              >
                {/* Progress to next level */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">次のレベルまで</span>
                    <span className="font-semibold text-slate-900">
                      あと {pointsToNextLevel} pt
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.max(5, Math.min(100, ((totalPoints % 500) / 500) * 100))}%`,
                      }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  </div>
                </div>

                {/* New badge */}
                {newBadge && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 rounded-xl bg-amber-50 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        新バッジ獲得!
                      </p>
                      <p className="text-xs text-amber-700">{newBadge}</p>
                    </div>
                  </motion.div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
                    onClick={onShare}
                  >
                    <Share2 className="mr-1.5 h-4 w-4" />
                    シェアする
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={onCaptureAnother}
                  >
                    <Camera className="mr-1.5 h-4 w-4" />
                    もう1枚撮る
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-1 py-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
                >
                  マップに戻る
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
