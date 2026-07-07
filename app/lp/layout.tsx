import type React from "react"
import { Zen_Maru_Gothic, Zen_Kaku_Gothic_New } from "next/font/google"
import "./lp.css"

// 見出し用の極太丸ゴシック(親子チック×チャンキー)。日本語グリフを含むため preload しない。
const zenMaru = Zen_Maru_Gothic({
  weight: ["700", "900"],
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
  return <div className={`lp-root ${zenMaru.variable} ${zenKaku.variable}`}>{children}</div>
}
