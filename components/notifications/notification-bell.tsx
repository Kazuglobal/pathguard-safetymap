"use client"

import { useState, useRef, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/hooks/use-notifications"
import { NotificationList } from "./notification-list"

interface NotificationBellProps {
  isLoggedIn?: boolean
}

export function NotificationBell({ isLoggedIn = false }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { unreadCount, notifications, markAsRead, markAllAsRead, isLoading } =
    useNotifications({ enabled: isLoggedIn })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Don't render if not logged in
  if (!isLoggedIn) {
    return null
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
  }

  const handleNotificationClick = async (id: string) => {
    await markAsRead(id)
  }

  return (
    <div className="relative notification-bell-container" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative notification-bell"
        onClick={handleToggle}
        data-testid="notification-bell"
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white notification-badge badge"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
