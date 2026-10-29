"use client"

import { useEffect, useState } from "react"
import { Share, SquarePlus, X } from "lucide-react"
import { shouldShowIosInstallGuide } from "@/lib/pwa-install"

const DISMISSED_KEY = "ios_install_prompt_dismissed"

// iOS Safari(非standalone)向けの「ホーム画面に追加」案内。
// iOS の Web Push はホーム画面に追加された PWA でのみ動くため、
// 通知許可プロンプト(PushPermissionPrompt)の代わりにこちらを表示する。
// ※iOSの非standaloneでは PushManager が存在せず push state は 'unsupported' に
//   なるので、両プロンプトが同時に出ることはない。
export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!shouldShowIosInstallGuide()) return
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) {
      setVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border bg-card p-4 shadow-lg">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label="閉じる"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <SquarePlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">ホーム画面に追加すると通知が受け取れます</p>
          <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="font-medium">1.</span>
              ブラウザの共有ボタン
              <Share className="inline h-3.5 w-3.5" aria-label="共有アイコン" />
              をタップ
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-medium">2.</span>
              「ホーム画面に追加」を選択
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-medium">3.</span>
              追加したアイコンからアプリを開く
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}
