
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
  Menu,
  X,
  Trophy,
  LogOut,
  BarChart3,
  UserCheck,
  Gamepad2,
  Home,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface NavigationProps {
  user?: any
  onLogout?: () => void
}

type NavItem = {
  key: string
  href: string
  label: string
  icon: LucideIcon
  description?: string
  emphasize?: boolean
}

export function Navigation({ user, onLogout }: NavigationProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

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
      key: "hazard-game",
      href: "/hazard-game",
      label: "発見",
      icon: Gamepad2,
      description: "ゲームで危険感度を向上",
      emphasize: true,
    },
    {
      key: "dashboard",
      href: "/dashboard",
      label: "速報",
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

  return (
    <>
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
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
              {user ? (
                <div className="hidden sm:flex flex-col items-end text-sm leading-tight">
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

              {/* モバイルメニュー切替 */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label="メニューを開閉"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* モバイルメニュー */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden bg-white border-t border-gray-200"
            >
              <div className="px-4 py-4 space-y-3">
                {[...desktopNavItems].map((item) => {
                  const Icon = item.icon
                  const active = isActivePath(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-xl transition-colors",
                        active ? "bg-sky-100 text-sky-700" : "hover:bg-gray-100",
                        item.key === "admin-dashboard" &&
                          "bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className={cn("font-medium", item.emphasize && "text-lg font-semibold")}>{item.label}</p>
                          {item.key === "admin-dashboard" && (
                            <UserCheck className="w-4 h-4 ml-2 text-purple-600" />
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}

                {/* モバイルユーザーセクション */}
                {user ? (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex items-center space-x-3 p-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                          isAdmin
                            ? "bg-gradient-to-br from-purple-500 to-pink-600"
                            : "bg-gradient-to-br from-blue-500 to-purple-600"
                        )}
                      >
                        {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.email?.split("@")[0] || "ユーザー"}
                          {isAdmin && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              管理者
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">レベル 5 / ポイント確認可</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onLogout?.()
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full justify-start mt-2"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      ログアウト
                    </Button>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        ログイン
                      </Button>
                    </Link>
                    <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="gradient" size="sm" className="w-full justify-start">
                        新規登録
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* モバイルボトムナビ */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
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
