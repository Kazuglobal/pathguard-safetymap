import { redirect } from "next/navigation"

/**
 * ランキングの画面は閉じた(2026-11-14)。ポイントを画面に出さなくなったので、ポイントの順位も出さない。
 * 古いリンクから来た人はマイページへ送る。ポイントのデータと付与の仕組みは残してある。
 */
export default function LeaderboardPage() {
  redirect("/mypage")
}
