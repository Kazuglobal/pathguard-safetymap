"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCheck, Bell, X } from "lucide-react"
import type { Notification } from "@/hooks/use-notifications"

interface NotificationListProps {
  notifications: Notification[]
  isLoading: boolean
  onNotificationClick: (id: string) => Promise<void>
  onMarkAllAsRead: () => Promise<void>
  onClose: () => void
}

export function NotificationList({
  notifications,
  isLoading,
  onNotificationClick,
  onMarkAllAsRead,
  onClose,
}: NotificationListProps) {
  const router = useRouter()

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "たった今"
    if (diffMins < 60) return `${diffMins}分前`
    if (diffHours < 24) return `${diffHours}時間前`
    if (diffDays < 7) return `${diffDays}日前`
    return date.toLocaleDateString("ja-JP")
  }

  const handleItemClick = async (notification: Notification) => {
    await onNotificationClick(notification.id)
    if (notification.link) {
      router.push(notification.link)
      onClose()
    }
  }

  const hasUnread = notifications.some((n) => !n.is_read)

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-white shadow-lg z-50 notification-dropdown"
      data-testid="notification-dropdown"
      role="menu"
      aria-label="通知一覧"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-gray-900">通知</h3>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700"
              data-testid="mark-all-read"
            >
              <CheckCheck className="mr-1 h-4 w-4" />
              全て既読
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notification list */}
      <div
        className="max-h-96 overflow-y-auto notification-list"
        data-testid="notification-list"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 text-gray-500 notification-empty"
            data-testid="notification-empty"
          >
            <Bell className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">通知はありません</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              role="menuitem"
              className={`w-full text-left border-b px-4 py-3 transition-colors hover:bg-gray-50 notification-item ${
                !notification.is_read ? "bg-blue-50 unread" : "read"
              }`}
              onClick={() => handleItemClick(notification)}
              data-testid="notification-item"
              data-read={notification.is_read}
            >
              <div className="flex items-start justify-between gap-2">
                <h4
                  className={`text-sm ${
                    !notification.is_read
                      ? "font-semibold text-gray-900"
                      : "font-normal text-gray-700"
                  }`}
                  data-testid="notification-title"
                >
                  {notification.title}
                </h4>
                {!notification.is_read && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                {notification.content}
              </p>
              <p
                className="mt-1 text-xs text-gray-400"
                data-testid="notification-timestamp"
              >
                {formatTimestamp(notification.created_at)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
