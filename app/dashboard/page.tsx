import { redirect } from "next/navigation"

/**
 * ホームは /landing の1つにし、ポイント・レベル・確認中の件数はマイページの「自分の記録」へ移した(UIUX改装 項目6)。
 * 古いリンクやブックマークから来た人のために、ページだけ残してマイページへ送る。
 * ログインしていない人は、/mypage の側でログイン画面へ送られる。
 */
export default function DashboardPage() {
  redirect("/mypage")
}
