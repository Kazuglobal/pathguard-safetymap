import { permanentRedirect } from "next/navigation"

export default async function RootPage() {
  // ルートは製品紹介LPへ恒久的に移す(308)。検索エンジンが / の評価を /lp にまとめられるようにする
  permanentRedirect("/lp")
}
