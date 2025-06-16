import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SupabaseProvider } from "@/components/providers/supabase-provider"
import { LayoutProvider } from "@/components/providers/layout-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PathGuardian - AI安全マップ",
  description: "AIとコミュニティの力で、安全な街づくりを支援するプラットフォーム。通学路・通勤路のリスクを可視化し、みんなで守る安心な環境を作ります。",
  keywords: "安全マップ, AI, 防災, 通学路, コミュニティ, リスク分析",
  authors: [{ name: "PathGuardian Team" }],
  creator: "PathGuardian",
  publisher: "PathGuardian",
  robots: "index, follow",
  generator: 'v0.dev',
  themeColor: "#0ea5e9"
}

export const dynamic = 'force-dynamic'

// Next.js 15+: metadata から分離
export const viewport = "width=device-width, initial-scale=1";


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
            <LayoutProvider>
              {children}
            </LayoutProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}