import type React from "react"

/**
 * きけんハンター専用レイアウト。
 * 丸ゴシック系のシステムフォントをこの配下で使用する。
 * ビルド時の外部フォント取得には依存しない。
 */
export default function HunterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="contents">
      {children}
    </div>
  )
}
