import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { LayoutProvider } from "@/components/providers/layout-provider"
import { getMaintenanceMode } from '@/lib/maintenance'
import { BRAND } from '@/lib/brand'

const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL || BRAND.siteUrl)

// 各ページはページ名だけを書く(例: "マイページ" → 「マイページ | PathGuardian」)。UIUX改装 項目1・3
export const metadata: Metadata = {
  metadataBase,
  title: { default: BRAND.defaultTitle, template: BRAND.titleTemplate },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: ["通学路", "見守り", "安全マップ", "ヒヤリハット", "不審者情報", "子ども", "防災"],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: BRAND.name,
    title: BRAND.defaultTitle,
    description: BRAND.description,
    images: [{ url: "/images/lp/og-share.png", alt: BRAND.defaultTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.defaultTitle,
    description: BRAND.description,
    images: ["/images/lp/og-share.png"],
  },
  // iOSホーム画面追加時の表示名・ステータスバー(app/manifest.ts と対で使う)
  appleWebApp: {
    capable: true,
    title: "PathGuardian",
    statusBarStyle: "default",
  },
}

export const viewport = {
  // 紙の色(app/manifest.ts の theme_color と同じ)
  themeColor: BRAND.themeColor,
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
