"use client"

import { useState, useEffect, useCallback } from 'react'
import type { NotificationPreferences } from '@/lib/notifications/builders'

/**
 * Base64URL → Uint8Array 変換 (VAPID公開鍵用)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export type PushSubscriptionState =
  | 'loading'
  | 'unsupported'
  | 'denied'
  | 'subscribed'
  | 'unsubscribed'

export interface UsePushSubscriptionReturn {
  state: PushSubscriptionState
  preferences: NotificationPreferences
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  danger_reports: true,
  news: true,
  magazine: true,
  local_alerts: true,
}

async function fetchSavedPreferences(endpoint: string): Promise<NotificationPreferences | null> {
  try {
    const res = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`)
    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as {
      subscribed?: boolean
      preferences?: NotificationPreferences | null
    }

    if (!data.subscribed || !data.preferences) {
      return null
    }

    return data.preferences
  } catch {
    return null
  }
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [state, setState] = useState<PushSubscriptionState>('loading')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  // 初期状態チェック
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    const checkState = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        const permission = Notification.permission

        if (permission === 'denied') {
          setState('denied')
          return
        }

        if (sub) {
          const savedPreferences = await fetchSavedPreferences(sub.endpoint)
          if (savedPreferences) {
            setPreferences(savedPreferences)
          }
          setSubscription(sub)
          setState('subscribed')
        } else {
          setState('unsubscribed')
        }
      } catch {
        setState('unsubscribed')
      }
    }

    checkState()
  }, [])

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return
    }

    try {
      // Service Worker 登録
      await navigator.serviceWorker.register('/sw.js')
      const reg = await navigator.serviceWorker.ready

      // 通知許可リクエスト
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'unsubscribed')
        return
      }

      // プッシュサブスクリプション作成
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })

      const subJson = sub.toJSON()
      const keys = subJson.keys as { p256dh: string; auth: string }

      // サーバーに登録
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          preferences,
        }),
      })

      if (!res.ok) {
        console.error('[push] subscribe API error', await res.text())
        return
      }

      setSubscription(sub)
      setState('subscribed')
    } catch (err) {
      console.error('[push] subscribe error', err)
    }
  }, [preferences])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return

    try {
      const res = await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })

      if (!res.ok && res.status !== 404) {
        console.error('[push] unsubscribe API error', res.status)
        return
      }

      // ブラウザのサブスクリプションを解除
      await subscription.unsubscribe()

      setSubscription(null)
      setState('unsubscribed')
    } catch (err) {
      console.error('[push] unsubscribe error', err)
    }
  }, [subscription])

  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      const previousPrefs = preferences
      const newPrefs = { ...preferences, ...prefs }
      setPreferences(newPrefs)

      if (!subscription) return

      try {
        const res = await fetch('/api/push/subscribe', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            preferences: newPrefs,
          }),
        })

        if (!res.ok) {
          setPreferences(previousPrefs)
          console.error('[push] updatePreferences API error', res.status)
        }
      } catch (err) {
        setPreferences(previousPrefs)
        console.error('[push] updatePreferences error', err)
      }
    },
    [preferences, subscription]
  )

  return { state, preferences, subscribe, unsubscribe, updatePreferences }
}
