"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Shield,
  Map,
  User,
  LogOut,
  UserCheck,
  Home,
  Route,
  PlusCircle,
  Newspaper,
  BarChart3,
} from "lucide-react"
import { motion } from "framer-motion"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { isAdminUser } from "@/lib/admin"
import { ReportBottomSheet } from "@/components/report/report-bottom-sheet"

interface NavigationProps {
  user?: any
  onLogout: () => void | Promise<void>
  isLoggingOut?: boolean
  hideTopNavMobile?: boolean
  isOverlay?: boolean
}

type NavItem = {
  key: string
  href: string
  label: string
  mobileLabel?: string
  icon: LucideIcon
  description?: string
  emphasize?: boolean
  isAction?: boolean
}

export function Navigation({
  user,
  onLogout,
  isLoggingOut = false,
  hideTopNavMobile = false,
  isOverlay = false,
}: NavigationProps) {
  const pathname = usePathname()
  const isAdmin = isAdminUser(user)
  const [isReportOpen, setIsReportOpen] = React.useState(false)

  const mainNavItems: NavItem[] = [
    {
      key: "home",
      href: "/landing",
      label: "ホーム",
      icon: Newspaper,
      description: "ヒヤリハット・ニュースフィード",
    },
    {
      key: "map",
      href: "/map",
      label: "マップ",
      icon: Map,
      description: "危険箇所を地図で確認",
    },
    {
      key: "report-action",
      href: "#report",
      label: "報告",
      icon: PlusCircle,
      description: "危険を今すぐ報告",
      emphasize: true,
      isAction: true,
    },
    {
      key: "routes",
      href: "/routes",
      label: "通学路",
      icon: Route,
      description: "通学路を管理",
    },
    {
      key: "activity",
      href: "/mypage",
      label: "活動",
      icon: User,
      description: "プロフィール・ミッション・設定",
    },
  ]

  const secondaryNavItems: NavItem[] = [
    {
      key: "report-stats",
      href: "/report",
      label: "報告一覧",
      icon: BarChart3,
      description: "危険報告の統計",
    },
  ]

  const adminNavItems: NavItem[] = isAdmin
    ? [
        {
          key: "admin-dashboard",
          href: "/admin/dashboard",
          label: "管理ダッシュボード",
          icon: BarChart3,
          description: "管理者向けツール",
        },
      ]
    : []

  const desktopNavItems = [...mainNavItems.filter((i) => !i.isAction), ...secondaryNavItems, ...adminNavItems]
  const bottomNavItems = mainNavItems

  // /hazard-game, /missions, /leaderboard はすべて「活動」タブをアクティブにする
  const activityPaths = ["/mypage", "/hazard-game", "/missions", "/leaderboard", "/badges"]

  const isActivePath = (item: NavItem) => {
    if (item.isAction) return false

    if (item.key === "activity") {
      return activityPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    }
    if (item.href === "/landing" && pathname === "/") {
      return true
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  const topNavClass = cn(
    "bg-white/95 backdrop-blur-md border-b border-gray-200 z-50",
    isOverlay ? "hidden md:block md:fixed md:top-0 md:inset-x-0" : "sticky top-0",
    hideTopNavMobile && "hidden md:block"
  )

  return (
    <>
      <nav className={topNavClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* ブランド */}
            <div className="flex items-center">
              <Link href="/landing" className="flex items-center space-x-2 group">
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">
                  <span className="text-sky-600">Path</span>
                  <span className="text-gray-900">Guardian</span>
                </span>
              </Link>
            </div>

            {/* デスクトップ用ナビゲーション */}
            <div className="hidden lg:flex items-center space-x-1">
              {desktopNavItems.map((item) => {
                const Icon = item.icon
                const active = isActivePath(item)
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={active ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "relative group",
                        active
                          ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                          : "hover:bg-gray-100",
                        item.key === "admin-dashboard" &&
                          "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="ml-2">{item.label}</span>
                      {active && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full"
                          layoutId="activeTab"
                          initial={false}
                        />
                      )}
                      {item.key === "admin-dashboard" && (
                        <UserCheck className="w-3 h-3 ml-1 text-purple-600" />
                      )}
                    </Button>
                  </Link>
                )
              })}
              {/* デスクトップ: 報告ボタン */}
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-400 to-rose-500 text-white hover:from-orange-500 hover:to-rose-600 ml-2"
                onClick={() => setIsReportOpen(true)}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                報告する
              </Button>
            </div>

            {/* 右側アクション */}
            <div className="flex items-center space-x-3">
              {user && <NotificationBell isLoggedIn={!!user} />}
              {user ? (
                <div className="hidden sm:flex items-center space-x-3">
                  <div className="flex flex-col items-end text-sm leading-tight user-info" data-testid="user-info">
                    <span className="font-semibold text-gray-900">
                      {user.email?.split("@")[0] || "ユーザー"}
                    </span>
                    <span className="text-xs text-gray-500">ログイン中</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    disabled={isLoggingOut}
                    data-testid="logout-button"
                    aria-label="ログアウト"
                    aria-busy={isLoggingOut}
                    className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm">
                      ログイン
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="gradient" size="sm">
                      新規登録
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* モバイルボトムナビ */}
      <nav className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t md:hidden",
        isOverlay
          ? "bg-white/90 backdrop-blur-lg border-gray-200/50 shadow-[0_-8px_30px_rgba(15,23,42,0.15)]"
          : "bg-white/95 backdrop-blur border-gray-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
      )}>
        <div
          className="mx-auto flex h-20 max-w-3xl items-center gap-1 px-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const active = isActivePath(item)
            const isEmphasized = item.emphasize

            if (item.isAction) {
              return (
                <button
                  key={item.key}
                  type="button"
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-tight transition-all text-slate-500"
                  aria-label={item.label}
                  onClick={() => setIsReportOpen(true)}
                >
                  <span className="flex h-14 w-14 -mt-2 items-center justify-center rounded-full border-none bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg transition-all">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="block max-w-[72px] truncate whitespace-nowrap text-center">
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-tight transition-all",
                  active ? "text-sky-600" : "text-slate-500"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border bg-white shadow-sm transition-all",
                    "h-10 w-10 border-transparent",
                    active && "border-sky-200 bg-sky-50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="block max-w-[72px] truncate whitespace-nowrap text-center">
                  {item.mobileLabel ?? item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 報告BottomSheet */}
      <ReportBottomSheet open={isReportOpen} onOpenChange={setIsReportOpen} />
    </>
  )
}
