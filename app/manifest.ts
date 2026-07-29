import type { MetadataRoute } from "next"

// PWAマニフェスト。iOS Safari の Web Push は「ホーム画面に追加されたPWA」でのみ
// 動作するため、standalone 表示とアイコン一式が通知基盤の前提になる。
// theme_color は app/layout.tsx の viewport.themeColor と一致させること。
export default function manifest(): MetadataRoute.Manifest {
  return {
    // start_url を将来変更しても同一アプリとして扱われるよう id を固定する
    id: "/",
    name: "PathGuardian - AI安全マップ",
    short_name: "PathGuardian",
    description:
      "AIとコミュニティの力で、安全な街づくりを支援するプラットフォーム。通学路・通勤路のリスクを可視化し、みんなで守る安心な環境を作ります。",
    lang: "ja",
    // "/" は /lp へ無条件リダイレクトのため、インストール済みアプリの起点は
    // ログイン不要のニュースフィード(デイリーハビット面)にする
    start_url: "/landing",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0ea5e9",
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
