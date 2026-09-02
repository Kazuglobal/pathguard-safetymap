import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { LayoutProvider } from "@/components/providers/layout-provider"
import { getMaintenanceMode } from '@/lib/maintenance'

const metadataBase = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : undefined

export const metadata: Metadata = {
  metadataBase,
  title: "PathGuardian - AI安全マップ",
  description: "AIとコミュニティの力で、安全な街づくりを支援するプラットフォーム。通学路・通勤路のリスクを可視化し、みんなで守る安心な環境を作ります。",
  keywords: "安全マップ, AI, 防災, 通学路, コミュニティ, リスク分析",
  authors: [{ name: "PathGuardian Team" }],
  creator: "PathGuardian",
  publisher: "PathGuardian",
  robots: "index, follow",
  generator: 'v0.dev',
}

export const viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const maintenanceMode = getMaintenanceMode()
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-app overflow-x-hidden">
        {maintenanceMode === 'read_only' && (
          <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">
            データ移行メンテナンス中です。閲覧はできますが、投稿・更新・削除は一時停止しています。
          </div>
        )}
        <LayoutProvider>
          {children}
        </LayoutProvider>
      </body>
    </html>
  )
}
