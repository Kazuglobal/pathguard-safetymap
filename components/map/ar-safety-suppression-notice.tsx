"use client"

import { cn } from "@/lib/utils"

interface ARSafetySuppressionNoticeProps {
  isLocationAccuracyLow: boolean
  isMovingTooFast: boolean
  /** 通常モード向け: 歩きスマホへの声かけを添える */
  showWalkPrompt?: boolean
  className?: string
}

/**
 * AR安全抑制(位置精度低下・移動速度超過)の状態メッセージ。
 * 親子モードのルートパネル内と通常モードのオーバーレイの両方で使う
 * (文言を2箇所に重複させないための共通コンポーネント)。
 * どちらの抑制も発生していなければ何も描画しない。
 */
export function ARSafetySuppressionNotice({
  isLocationAccuracyLow,
  isMovingTooFast,
  showWalkPrompt = false,
  className,
}: ARSafetySuppressionNoticeProps) {
  if (!isLocationAccuracyLow && !isMovingTooFast) return null

  return (
    <div className={cn("space-y-2", className)}>
      {isLocationAccuracyLow && (
        <p className="text-xs text-amber-100">位置精度が低いため強調を抑制中</p>
      )}
      {isMovingTooFast && (
        <p className="text-xs text-amber-100">
          移動速度が速いため接近通知を抑制中
          {showWalkPrompt && "。とまって かくにんしてね"}
        </p>
      )}
    </div>
  )
}
