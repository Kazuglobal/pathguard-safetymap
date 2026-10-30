import type { MetadataRoute } from "next"

import { BRAND } from "@/lib/brand"

// PWAマニフェスト。iOS Safari の Web Push は「ホーム画面に追加されたPWA」でのみ
// 動作するため、standalone 表示とアイコン一式が通知基盤の前提になる。
// theme_color は app/layout.tsx の viewport.themeColor と一致させること。
export default function manifest(): MetadataRoute.Manifest {
  return {
    // start_url を将来変更しても同一アプリとして扱われるよう id を固定する
    id: "/",
    name: BRAND.defaultTitle,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: "ja",
    // "/" は /lp へ無条件リダイレクトのため、インストール済みアプリの起点は
    // ログイン不要のニュースフィード(デイリーハビット面)にする
    start_url: "/landing",
    scope: "/",
    display: "standalone",
    background_color: BRAND.themeColor,
    theme_color: BRAND.themeColor,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
