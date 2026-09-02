"use client"

import { useState, useEffect, useCallback } from "react"
import type { AuthChangeEvent } from "@supabase/supabase-js"
import { useSupabase } from "@/components/providers/supabase-provider"

export type { NotificationPreferences, PushPayload } from "@/lib/notifications/builders"
export {
  ROUTE_REPORT_NOTIFICATION_TYPE,
  getNotificationTypeLabel,
  buildRouteReportNotification,
  buildDangerReportPushPayload,
  buildNewsPushPayload,
  buildMagazinePushPayload,
} from "@/lib/notifications/builders"

export interface Notification {
  id: string
  title: string
  content: string
  type: string
  is_read: boolean
  link?: string
  created_at: string
  user_id: string
}

type UseNotificationsOptions = {
  enabled?: boolean
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true } = options
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { supabase } = useSupabase()

  const fetchNotifications = useCallback(async () => {
    try {
      if (!enabled) {
        setNotifications([])
        setUnreadCount(0)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/notifications", { credentials: "same-origin" })
      if (!response.ok) {
        setError(`通知の取得に失敗しました (${response.status})`)
        return
      }
      const payload = await response.json() as { notifications?: Notification[] }
      const notificationsList = payload.notifications ?? []
      setNotifications(notificationsList)
      setUnreadCount(notificationsList.filter((n: Notification) => !n.is_read).length)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "通知の取得に失敗しました"
      )
    } finally {
      setIsLoading(false)
    }
  }, [enabled, supabase])

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          credentials: "same-origin", body: JSON.stringify({ id }),
        })
        if (!response.ok) {
          setError("通知の更新に失敗しました")
          return
        }

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "通知の更新に失敗しました"
        )
      }
    },
    []
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ all: true }),
      })
      if (!response.ok) {
        setError("通知の一括更新に失敗しました")
        return
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "通知の一括更新に失敗しました"
      )
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    fetchNotifications()

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_IN") {
        fetchNotifications()
      } else if (event === "SIGNED_OUT") {
        setNotifications([])
        setUnreadCount(0)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [enabled, fetchNotifications, supabase])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
