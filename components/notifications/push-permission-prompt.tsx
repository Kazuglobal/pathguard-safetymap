"use client"

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/use-push-subscription'

const DISMISSED_KEY = 'push_prompt_dismissed'

export function PushPermissionPrompt() {
  const { state, subscribe } = usePushSubscription()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state !== 'unsubscribed') return
    if (typeof window === 'undefined') return
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) {
      setVisible(true)
    }
  }, [state])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  const handleSubscribe = async () => {
    await subscribe()
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
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">通学路の安全情報を通知で受け取る</p>
          <p className="mt-1 text-xs text-muted-foreground">
            登録した通学路近くの危険報告やニュースをお知らせします
          </p>
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={handleSubscribe}
          >
            通知を許可する
          </Button>
        </div>
      </div>
    </div>
  )
}
