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
  Award,
  Trophy,
  LogOut,
  BarChart3,
  UserCheck,
  Gamepad2,
  Home,
  Route,
} from "lucide-react"
import { motion } from "framer-motion"
import { NotificationBell } from "@/components/notifications/notification-bell"

interface NavigationProps {
  user?: any
  onLogout?: () => void
  hideTopNavMobile?: boolean
  isOverlay?: boolean
}

type NavItem = {
  key: string
  href: string
  label: string
  icon: LucideIcon
  description?: string
  emphasize?: boolean
}

export function Navigation({ user, onLogout, hideTopNavMobile = false, isOverlay = false }: NavigationProps) {
  const pathname = usePathname()
  // 管理者チェック（暫定実装）
  const isAdmin = user?.email?.includes("admin") || user?.role === "admin"

  const mainNavItems: NavItem[] = [
    {
      key: "home",
      href: "/landing",
      label: "ホーム",
      icon: Home,
      description: "トップコンテンツ",
    },
    {
      key: "map",
      href: "/map",
      label: "マップ",
      icon: Map,
      description: "危険箇所を地図で確認",
    },
    {
      key: "routes",
      href: "/routes",
      label: "通学路",
      icon: Route,
      description: "通学路を管理",
    },
    {
      key: "hazard-game",
      href: "/hazard-game",
      label: "発見",
      icon: Gamepad2,
      description: "ゲームで危険感度を向上",
      emphasize: true,
    },
    {
      key: "dashboard",
      href: "/report",
      label: "報告",
      icon: BarChart3,
      description: "最新レポートと統計",
    },
    {
      key: "mypage",
      href: "/mypage",
      label: "マイページ",
      icon: User,
      description: "ミッションやコレクション",
    },
  ]

  const secondaryNavItems: NavItem[] = [
    {
      key: "missions",
      href: "/missions",
      label: "ミッション",
      icon: Award,
      description: "挑戦中のタスク",
    },
    {
      key: "leaderboard",
      href: "/leaderboard",
      label: "ランキング",
      icon: Trophy,
      description: "スコアを確認",
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

  const desktopNavItems = [...mainNavItems, ...secondaryNavItems, ...adminNavItems]
  const bottomNavItems = mainNavItems

  const isActivePath = (href: string) => {
    if (href === "/landing" && pathname === "/") {
      return true
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const topNavClass = cn(
    "bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50",
    hideTopNavMobile && "hidden md:block",
    isOverlay && "hidden" // マップオーバーレイモードではトップナビを非表示
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
                const active = isActivePath(item.href)
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
            </div>

            {/* 右側アクション */}
            <div className="flex items-center space-x-3">
              {user && <NotificationBell isLoggedIn={!!user} />}
              {user ? (
                <div className="hidden sm:flex flex-col items-end text-sm leading-tight user-info" data-testid="user-info">
                  <span className="font-semibold text-gray-900">
                    {user.email?.split("@")[0] || "ユーザー"}
                  </span>
                  <span className="text-xs text-gray-500">ログイン中</span>
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
            const active = isActivePath(item.href)
            const isEmphasized = item.emphasize
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-tight transition-all",
                  active ? "text-sky-600" : "text-slate-500"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border bg-white shadow-sm transition-all",
                    isEmphasized
                      ? "h-14 w-14 -mt-2 border-none bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg"
                      : "h-10 w-10 border-transparent",
                    active && !isEmphasized && "border-sky-200 bg-sky-50"
                  )}
                >
                  <Icon className={cn(isEmphasized ? "h-6 w-6" : "h-5 w-5")} />
                </span>
                <span className="max-w-[72px] text-center">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

    </>
  )
}
