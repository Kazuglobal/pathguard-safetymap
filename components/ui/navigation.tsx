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
  LogOut
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface NavigationProps {
  user?: any
  onLogout?: () => void
}

export function Navigation({ user, onLogout }: NavigationProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  const navItems = [
    {
      href: "/map",
      label: "マップ", 
      icon: <Map className="w-4 h-4" />,
      description: "安全マップを見る"
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
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActivePath(item.href) ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "relative group",
                    isActivePath(item.href) 
                      ? "bg-sky-100 text-sky-700 hover:bg-sky-200" 
                      : "hover:bg-gray-100"
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
                    </p>
                    <p className="text-xs text-gray-500">
                      レベル 5 • 貢献者
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
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
              className="md:hidden"
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
            className="md:hidden bg-white border-t border-gray-200"
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
                      : "hover:bg-gray-100"
                  )}
                >
                  {item.icon}
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </Link>
              ))}

              {/* モバイルユーザーセクション */}
              {user ? (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center space-x-3 p-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.email?.split('@')[0] || 'ユーザー'}
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

// フッターナビゲーション（モバイル用）
export function MobileBottomNavigation() {
  const pathname = usePathname()
  
  const bottomNavItems = [
    {
      href: "/map",
      label: "マップ",
      icon: <MapPin className="w-5 h-5" />
    },
    {
      href: "/missions", 
      label: "ミッション",
      icon: <Award className="w-5 h-5" />
    },
    {
      href: "/leaderboard",
      label: "ランキング", 
      icon: <Trophy className="w-5 h-5" />
    },
    {
      href: "/dashboard",
      label: "プロフィール",
      icon: <User className="w-5 h-5" />
    }
  ]

  const isActivePath = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50">
      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center space-y-1 p-3 rounded-xl transition-all duration-200",
              isActivePath(item.href)
                ? "bg-sky-100 text-sky-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
} 