import type React from "react"
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google"
import "./lp.css"

// 見出し用の明朝(プレミアム・信頼感)。日本語グリフを含むため preload しない。
const shippori = Shippori_Mincho({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lp-display",
  preload: false,
})

// 本文用のゴシック
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lp-body",
  preload: false,
})

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return <div className={`lp-root ${shippori.variable} ${zenKaku.variable}`}>{children}</div>
}
