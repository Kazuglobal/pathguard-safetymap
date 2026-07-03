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
  Route,
  Newspaper,
  BarChart3,
  Search,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { isAdminUser } from "@/lib/admin"
import { ReportBottomSheet } from "@/components/report/report-bottom-sheet"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

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

/** ルペ(虫めがねの相棒)のミニ顔 — ボトムナビ中央ボタン用 */
function LupeFace({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 124 124" aria-hidden="true">
      {/* もち手(木) */}
      <g transform="rotate(43 88 88)">
        <rect x={83} y={80} width={13} height={34} rx={6.5} fill="#C98A4B" stroke={C.ink} strokeWidth={3} />
      </g>
      {/* レンズ外輪(みどり) */}
      <circle cx={62} cy={62} r={34} fill={C.primary} stroke={C.ink} strokeWidth={3.4} />
      {/* レンズ面(クリーム) */}
      <circle cx={62} cy={62} r={26.5} fill="#FFF9EC" stroke={C.ink} strokeWidth={2} />
      <path d="M44 50 q6 -10 18 -12" stroke="#fff" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.75} />
      {/* ほっぺ・目・くち */}
      <circle cx={47} cy={68} r={4.6} fill={C.berry} opacity={0.4} />
      <circle cx={77} cy={68} r={4.6} fill={C.berry} opacity={0.4} />
      <g fill={C.ink}>
        <circle cx={52} cy={60} r={5.4} />
        <circle cx={72} cy={60} r={5.4} />
        <circle cx={50.2} cy={58} r={1.8} fill="#fff" />
        <circle cx={70.2} cy={58} r={1.8} fill="#fff" />
      </g>
      <path d="M52 71 q10 10 20 0" stroke={C.ink} strokeWidth={3.6} strokeLinecap="round" fill="none" />
      {/* 安全帽(黄) */}
      <path
        d="M40 36 Q42 18 62 18 Q82 18 84 36 L84 39 Q62 32 40 39 Z"
        fill={C.sun}
        stroke={C.ink}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <path
        d="M36 38.5 Q62 30 88 38.5 Q90 43 86 43.5 Q62 37 38 43.5 Q34 43 36 38.5 Z"
        fill={C.sunDeep}
        stroke={C.ink}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  )
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
  const reduce = useReducedMotion()

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
      label: "きけんハンター",
      mobileLabel: "ハンター",
      icon: Search,
      description: "写真で危険をさがす練習",
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
    "z-50 border-b",
    isOverlay ? "hidden md:block md:fixed md:top-0 md:inset-x-0" : "sticky top-0",
    hideTopNavMobile && "hidden md:block"
  )

  return (
    <>
      <nav
        className={topNavClass}
        style={{
          background: "rgba(251,245,233,.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: tankenTokens.border.faint,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* ブランド */}
            <div className="flex items-center">
              <Link
                href="/landing"
                className="group flex items-center space-x-2 rounded-full px-1"
              >
                <motion.div
                  whileHover={reduce ? undefined : { rotate: -8, scale: 1.06 }}
                  transition={tankenTokens.spring}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2"
                  style={{
                    background: C.primary,
                    borderColor: "rgba(67,57,43,.2)",
                    boxShadow: "0 2px 0 rgba(12,122,85,.8)",
                  }}
                >
                  <Shield className="h-5 w-5 text-white" strokeWidth={2.4} />
                </motion.div>
                <span className="text-xl font-black tracking-tight" style={{ color: C.ink }}>
                  Path<span style={{ color: C.primary }}>Guardian</span>
                </span>
              </Link>
            </div>

            {/* デスクトップ用ナビゲーション */}
            <div className="hidden lg:flex items-center gap-1">
              {desktopNavItems.map((item) => {
                const Icon = item.icon
                const active = isActivePath(item)
                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={cn(
                        "relative inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors",
                        active ? "" : "hover:bg-[rgba(67,57,43,.06)]"
                      )}
                      style={{
                        color: active ? "#fff" : C.inkSoft,
                      }}
                    >
                      {active && (
                        <motion.span
                          layoutId="activeTopTab"
                          className="absolute inset-0 rounded-full"
                          style={{ background: C.primary, boxShadow: "0 2px 0 " + C.primaryStrong }}
                          transition={reduce ? { duration: 0 } : tankenTokens.spring}
                        />
                      )}
                      <Icon className="relative h-4 w-4" strokeWidth={2.5} />
                      <span className="relative">{item.label}</span>
                      {item.key === "admin-dashboard" && (
                        <UserCheck className="relative h-3 w-3" />
                      )}
                    </span>
                  </Link>
                )
              })}
              {/* デスクトップ: きけんハンターボタン */}
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className={cn(
                  "chunky-press ml-2 inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 text-sm font-black text-white",
                  tankenTokens.cls.focus
                )}
                style={{
                  background: C.accent,
                  borderColor: "rgba(67,57,43,.18)",
                  boxShadow: tankenTokens.shadow.pressAccent,
                }}
              >
                <Search className="h-4 w-4" strokeWidth={2.8} />
                きけんハンター
              </button>
            </div>

            {/* 右側アクション */}
            <div className="flex items-center space-x-3">
              {user && <NotificationBell isLoggedIn={!!user} />}
              {user ? (
                <div className="hidden sm:flex items-center space-x-3">
                  <div className="flex flex-col items-end text-sm leading-tight user-info" data-testid="user-info">
                    <span className="font-bold" style={{ color: C.ink }}>
                      {user.email?.split("@")[0] || "ユーザー"}
                    </span>
                    <span className="text-xs" style={{ color: C.inkFaint }}>ログイン中</span>
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

      {/* モバイルボトムナビ(たんけんノートの持ち手) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t md:hidden"
        style={{
          background: "rgba(255,253,247,.94)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderColor: tankenTokens.border.faint,
          boxShadow: "0 -1px 0 rgba(67,57,43,.04), 0 -12px 30px -18px rgba(67,57,43,.35)",
        }}
      >
        <div
          className="mx-auto flex h-[4.5rem] max-w-3xl items-stretch px-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const active = isActivePath(item)

            if (item.isAction) {
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    "relative flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 text-[10.5px] font-black leading-tight",
                    tankenTokens.cls.focus
                  )}
                  style={{ color: C.inkSoft }}
                  aria-label={item.label}
                  onClick={() => setIsReportOpen(true)}
                >
                  <motion.span
                    whileTap={reduce ? undefined : { scale: 0.9, y: 3 }}
                    transition={tankenTokens.spring}
                    className="absolute -top-5 flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border-2"
                    style={{
                      background: C.sun,
                      borderColor: "rgba(67,57,43,.22)",
                      boxShadow: `${tankenTokens.shadow.pressSun}, 0 10px 22px -10px rgba(226,168,18,.7)`,
                    }}
                  >
                    <LupeFace size={40} />
                  </motion.span>
                  <span className="mt-auto block max-w-[72px] truncate whitespace-nowrap text-center">
                    {item.mobileLabel ?? item.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] leading-tight",
                  active ? "font-black" : "font-bold",
                  tankenTokens.cls.focus
                )}
                style={{ color: active ? C.primaryStrong : C.inkFaint }}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative flex h-9 w-14 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="activeBottomTab"
                      className="absolute inset-0 rounded-full"
                      style={{ background: C.primarySoft }}
                      transition={reduce ? { duration: 0 } : tankenTokens.spring}
                    />
                  )}
                  <Icon
                    className="relative h-[1.35rem] w-[1.35rem]"
                    strokeWidth={active ? 2.6 : 2.2}
                  />
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
