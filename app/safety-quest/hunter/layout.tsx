import type React from "react"
import { Zen_Maru_Gothic } from "next/font/google"

/**
 * きけんハンター専用レイアウト。
 * 丸ゴシック(Zen Maru Gothic)をこの配下だけに読み込み、
 * アプリ全体のフォント(Inter)には影響させない。
 */
const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hunter",
  preload: false,
})

export default function HunterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${zenMaru.variable} contents`}>
      {children}
    </div>
  )
}
