import type React from "react"
import type { Metadata } from "next"
import { Inter, Zen_Maru_Gothic } from "next/font/google"
import "./globals.css"
import { LayoutProvider } from "@/components/providers/layout-provider"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

// アプリ全体のブランドフォント(たんけんノート)。日本語グリフを含むため preload しない。
const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
  preload: false,
})

export const metadata: Metadata = {
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
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${zenMaru.variable} ${inter.variable} font-app overflow-x-hidden`}>
        <LayoutProvider>
          {children}
        </LayoutProvider>
      </body>
    </html>
  )
}