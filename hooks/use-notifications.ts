"use client"

import { useState, useEffect, useCallback } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"

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

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotifications([])
        setUnreadCount(0)
        return
      }

      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      const notificationsList = data || []
      setNotifications(notificationsList)
      setUnreadCount(notificationsList.filter((n) => !n.is_read).length)
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
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)

        if (updateError) {
          setError(updateError.message)
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
    [supabase]
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "通知の一括更新に失敗しました"
      )
    }
  }, [supabase])

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
    } = supabase.auth.onAuthStateChange((event) => {
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
