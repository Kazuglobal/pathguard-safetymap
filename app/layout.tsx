import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SupabaseProvider } from "@/components/providers/supabase-provider"
import { Navigation } from "@/components/ui/navigation"
import { createServerClient } from "@/lib/supabase-server"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PathGuardian - AI安全マップ",
  description: "AIとコミュニティの力で、安全な街づくりを支援するプラットフォーム。通学路・通勤路のリスクを可視化し、みんなで守る安心な環境を作ります。",
  keywords: "安全マップ, AI, 防災, 通学路, コミュニティ, リスク分析",
  authors: [{ name: "PathGuardian Team" }],
  creator: "PathGuardian",
  publisher: "PathGuardian",
  robots: "index, follow",
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#0ea5e9",
  generator: 'v0.dev'
}

export const dynamic = 'force-dynamic'

async function LayoutContent({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  
  // ユーザー情報を取得（エラーハンドリング付き）
  let user = null
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    user = currentUser
  } catch (error) {
    console.error("ユーザー情報の取得に失敗しました:", error)
  }

  const handleLogout = async () => {
    "use server"
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  }

  // ナビゲーションを表示しないページ
  const noNavPages = ['/login', '/register', '/landing']
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const showNavigation = !noNavPages.some(page => currentPath.startsWith(page))

  return (
    <div className="min-h-screen bg-background">
      {/* ナビゲーション */}
      {showNavigation && (
        <Navigation 
          user={user} 
          onLogout={handleLogout}
        />
      )}
      
      {/* メインコンテンツ */}
      <main>
        {children}
      </main>
      

    </div>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SupabaseProvider>
            <LayoutContent>
              {children}
            </LayoutContent>
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}