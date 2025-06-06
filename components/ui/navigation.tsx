"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  Shield, 
  Map, 
  User, 
  Settings, 
  Bell, 
  Award,
  Menu,
  X,
  Home,
  MapPin,
  Trophy,
  LogOut,
  BarChart3,
  UserCheck
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface NavigationProps {
  user?: any
  onLogout?: () => void
}

export function Navigation({ user, onLogout }: NavigationProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  // ユーザーが管理者かチェック（実際の実装では適切な権限チェックロジックを使用）
  const isAdmin = user?.email?.includes('admin') || user?.role === 'admin'

  const navItems = [
    {
      href: "/map",
      label: "地図", 
      icon: <Map className="w-5 h-5" />,
      description: "安全マップを表示・危険箇所を確認",
      isPrimary: true
    },
    {
      href: "/dashboard",
      label: "ダッシュボード",
      icon: <BarChart3 className="w-4 h-4" />,
      description: "活動状況とプロフィール"
    },
    {
      href: "/missions",
      label: "ミッション",
      icon: <Award className="w-4 h-4" />,
      description: "チャレンジに参加"
    },
    {
      href: "/leaderboard", 
      label: "ランキング",
      icon: <Trophy className="w-4 h-4" />,
      description: "貢献度ランキング"
    },
    // 管理者のみ表示
    ...(isAdmin ? [{
      href: "/admin/dashboard",
      label: "管理ダッシュボード",
      icon: <BarChart3 className="w-4 h-4" />,
      description: "管理者機能"
    }] : [])
  ]

  const isActivePath = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴ */}
          <div className="flex items-center">
            <Link 
              href="/" 
              className="flex items-center space-x-2 group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">
                <span className="text-sky-600">Path</span>
                <span className="text-gray-900">Guardian</span>
              </span>
            </Link>
          </div>

          {/* デスクトップナビゲーション */}
          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActivePath(item.href) ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "relative group",
                    isActivePath(item.href) 
                      ? "bg-sky-100 text-sky-700 hover:bg-sky-200" 
                      : "hover:bg-gray-100",
                    item.href === "/admin/dashboard" && "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200"
                  )}
                >
                  {item.icon}
                  <span className="ml-2">{item.label}</span>
                  {isActivePath(item.href) && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full"
                      layoutId="activeTab"
                      initial={false}
                    />
                  )}
                  {item.href === "/admin/dashboard" && (
                    <UserCheck className="w-3 h-3 ml-1 text-purple-600" />
                  )}
                </Button>
              </Link>
            ))}
          </div>

          {/* ユーザーアクション */}
          <div className="flex items-center space-x-2">
            {user ? (
              <div className="flex items-center space-x-2">
                {/* 通知ボタン */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                    2
                  </span>
                </Button>

                {/* ユーザーメニュー */}
                <div className="hidden md:flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {user.email?.split('@')[0] || 'ユーザー'}
                      {isAdmin && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          管理者
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      レベル 5 • 貢献者
                    </p>
                  </div>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                    isAdmin 
                      ? "bg-gradient-to-br from-purple-500 to-pink-600" 
                      : "bg-gradient-to-br from-blue-500 to-purple-600"
                  )}>
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="hidden md:flex"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-2">
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

            {/* モバイルメニューボタン */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
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
              {/* モバイルナビゲーションアイテム */}
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-xl transition-colors",
                    isActivePath(item.href)
                      ? "bg-sky-100 text-sky-700"
                      : "hover:bg-gray-100",
                    item.href === "/admin/dashboard" && "bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200",
                    item.isPrimary && !isActivePath(item.href) && "bg-gradient-to-r from-green-50 to-blue-50 border border-green-200"
                  )}
                >
                  {item.icon}
                  <div className="flex-1">
                    <div className="flex items-center">
                      <p className={cn(
                        "font-medium",
                        item.isPrimary && "text-lg font-semibold"
                      )}>{item.label}</p>
                      {item.href === "/admin/dashboard" && (
                        <UserCheck className="w-4 h-4 ml-2 text-purple-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </Link>
              ))}

              {/* モバイルユーザーセクション */}
              {user ? (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center space-x-3 p-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                      isAdmin 
                        ? "bg-gradient-to-br from-purple-500 to-pink-600" 
                        : "bg-gradient-to-br from-blue-500 to-purple-600"
                    )}>
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.email?.split('@')[0] || 'ユーザー'}
                        {isAdmin && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            管理者
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        レベル 5 • 貢献者
                      </p>
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
  )
} 